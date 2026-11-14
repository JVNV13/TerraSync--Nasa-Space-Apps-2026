"""Mars HiRISE/MOLA reproducible data pipeline. Run from any cwd; requires rasterio scipy numba numpy matplotlib.

Two modes, chosen automatically:
 * full   - the original PDS sources are present in ../Mars: everything is rebuilt from them.
 * derive - the sources are absent (they are not bundled with the deliverable): every product that
            depends only on the stored 30 m analysis DEM (terrain, illumination, reports, frontend,
            manifest) is rebuilt from processed/common/*_DEM_analysis_30m.tif. Source-level reports
            (input_quality_before.json, MOLA products, native 2 m patches) are left untouched.
"""
from pathlib import Path
import os, re, csv, json, hashlib, math, shutil, time
import numpy as np
import rasterio
from rasterio.windows import Window
from rasterio.transform import Affine
from rasterio.enums import Resampling
from rasterio.warp import reproject
from scipy.ndimage import uniform_filter, minimum_filter, maximum_filter
from numba import njit
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

ROOT=Path(__file__).resolve().parent
if ROOT.name == 'Mars_Processed':
 ROOT=ROOT.parent
INPUT=ROOT/'Mars'
OUT=ROOT/'Mars_Processed'
SLOPE_BIN_DEG=1.0
SLOPE_THRESHOLDS_DEG=[5,10,15,20,25,30]
for sub in ('processed/common','processed/terrain','processed/illumination','metadata','reports','figures','frontend'):(OUT/sub).mkdir(parents=True,exist_ok=True)
NOD=-9999.0
R_MARS=3396000.0
AZIMUTHS=list(range(0,360,45))
ALTITUDES=[5,15,30]
MAX_SHADOW_M=1200.0
ANALYSIS_M=30.0
PATCH_RAW_WIDTH=1200
PATCH_RAW_HEIGHT=1500

def dump(path,obj):
 path=OUT/path
 path.parent.mkdir(parents=True,exist_ok=True)
 path.write_text(json.dumps(obj,ensure_ascii=False,indent=2,default=lambda x: x.item() if isinstance(x,np.generic) else str(x)),encoding='utf-8')

def sha256(path):
 h=hashlib.sha256()
 with open(path,'rb') as f:
  for chunk in iter(lambda:f.read(4<<20),b''):h.update(chunk)
 return h.hexdigest()

def label_text(p):
 # PDS3 HiRISE has embedded ASCII label before image data
 if p.name.upper().startswith('DTEED'):
  with open(p,'rb') as f: b=f.read(18000)
  return b.decode('ascii',errors='replace').split('END\r\n')[0]+'END\n'
 return p.read_text(errors='replace')

def save_raster(rel,a,transform,crs,nodata=NOD,description=None):
 path=OUT/rel
 path.parent.mkdir(exist_ok=True,parents=True)
 dtype=a.dtype
 kwargs=dict(driver='GTiff',width=a.shape[1],height=a.shape[0],count=1,dtype=dtype,transform=transform,crs=crs,compress='deflate',predictor=3 if np.issubdtype(dtype,np.floating) else 2,tiled=True,blockxsize=256,blockysize=256,bigtiff='IF_SAFER')
 if nodata is not None:kwargs['nodata']=nodata
 with rasterio.open(path,'w',**kwargs) as dst:
  dst.write(a,1)
  if description:dst.set_band_description(1,description)
 return path

def basic_stats(a,valid,unit='m'):
 # unit is stated explicitly: slope is in degrees, heights/relief/roughness in metres
 v=np.asarray(a[valid],dtype=np.float64)
 f=lambda fn:float(fn(v)) if len(v) else None
 return dict(count=int(v.size),unit=unit,min=f(np.min),max=f(np.max),mean=f(np.mean),std=f(np.std))

def circular_stats(a,valid):
 # aspect is an angle: an arithmetic mean/std is meaningless (359 deg and 1 deg average to 180).
 v=np.radians(np.asarray(a[valid],dtype=np.float64))
 if not len(v):return dict(count=0,unit='deg clockwise from grid north')
 c=float(np.mean(np.cos(v)));s=float(np.mean(np.sin(v)));r=math.hypot(c,s)
 octants=np.bincount((np.round(np.degrees(v)/45).astype(int))%8,minlength=8)
 return dict(count=int(v.size),unit='deg clockwise from grid north',circular_mean=float(np.degrees(math.atan2(s,c))%360),mean_resultant_length=r,circular_std_deg=float(np.degrees(math.sqrt(max(0.0,-2*math.log(r))))) if r>0 else None,octant_fraction={k:float(n/v.size) for k,n in zip(['N','NE','E','SE','S','SW','W','NW'],octants)},note='circular statistics; no arithmetic mean is reported for an angle')

def slope_distribution(slope,valid):
 v=np.asarray(slope[valid],dtype=np.float64)
 edges=np.arange(0,90+SLOPE_BIN_DEG,SLOPE_BIN_DEG)
 counts,_=np.histogram(v,bins=edges)
 last=int(np.nonzero(counts)[0].max())+1 if counts.any() else 0
 q=[5,10,25,50,75,90,95,99]
 return dict(unit='deg',bin_width_deg=SLOPE_BIN_DEG,bin_start_deg=0.0,counts=[int(c) for c in counts[:last]],count=int(v.size),percentiles_deg={f'p{k:02d}':float(x) for k,x in zip(q,np.percentile(v,q))},fraction_steeper_than={f'{t}deg':float(np.mean(v>t)) for t in SLOPE_THRESHOLDS_DEG},baseline_m='central difference over two analysis cells (~60 m)')

def inspect_hirise(path):
 d={'source':path.name,'sha256':sha256(path),'bytes':path.stat().st_size}
 with rasterio.open(path) as src:
  d.update(driver=src.driver,dtype=src.dtypes[0],width=src.width,height=src.height,crs_wkt=src.crs.to_wkt(),pixel_size_m=[abs(src.transform.a),abs(src.transform.e)],transform=list(src.transform)[:6],bounds_m=list(src.bounds),nodata=float(src.nodata),scale=src.scales[0],offset=src.offsets[0])
  n=0;v=0;finite_bad=0;minval=float('inf');maxval=-float('inf');jumps=0;minmax=[]
  for _,win in src.block_windows(1):
   a=src.read(1,window=win,masked=True)
   mask=~np.ma.getmaskarray(a)
   raw=np.asarray(a.data)
   valid=mask & np.isfinite(raw)
   n+=raw.size;v+=int(np.count_nonzero(valid));finite_bad+=int(np.count_nonzero(mask & ~np.isfinite(raw)))
   if valid.any():
    arr=raw[valid];minval=min(minval,float(arr.min()));maxval=max(maxval,float(arr.max()))
    hor=valid[:,1:]&valid[:,:-1];ver=valid[1:,:]&valid[:-1,:]
    jumps+=int(np.count_nonzero((np.abs(np.diff(raw,axis=1))>50)&hor))
    jumps+=int(np.count_nonzero((np.abs(np.diff(raw,axis=0))>50)&ver))
  d.update(total_cells=n,valid_cells=v,valid_pct=100*v/n,nodata_cells=n-v,nonfinite_unmasked=finite_bad,elevation_min_m=minval,elevation_max_m=maxval,adjacent_jumps_gt_50m_within_blocks=jumps)
 return d

def choose_window(src):
 # rank valid proportion on decimated 1/10 mask; no data imputation
 scale=10
 w=min(PATCH_RAW_WIDTH,src.width)
 h=min(PATCH_RAW_HEIGHT,src.height)
 d=src.read(1,out_shape=(math.ceil(src.height/scale),math.ceil(src.width/scale)),resampling=Resampling.nearest,masked=True)
 v=(~np.ma.getmaskarray(d)).astype(np.float64)
 hh=max(1,round(h/scale));ww=max(1,round(w/scale))
 # summed area sliding window at stride 10 coarse pixels
 integral=np.pad(v,((1,0),(1,0))).cumsum(0).cumsum(1)
 best=(-1,None,None)
 for y in range(0,v.shape[0]-hh+1,10):
  xs=np.arange(0,v.shape[1]-ww+1,10)
  scores=integral[y+hh,xs+ww]-integral[y,xs+ww]-integral[y+hh,xs]+integral[y,xs]
  j=np.argmax(scores)
  if scores[j]>best[0]:best=(float(scores[j]),y,int(xs[j]))
 row=min(best[1]*scale,src.height-h);col=min(best[2]*scale,src.width-w)
 return Window(col,row,w,h),best[0]/(hh*ww)

def terrain(dem,valid,dx,dy=None):
 # dx = east-west cell size, dy = north-south cell size (metres). The analysis cells are not square.
 if dy is None:dy=dx
 # exact 3x3 stencil validity for central differences
 m=valid.astype(np.float32)
 count3=uniform_filter(m,size=3,mode='constant',cval=0)*9
 m3=(count3>8.999)&valid
 z=np.where(valid,dem,0).astype(np.float64)
 gx=np.zeros_like(z,dtype=np.float32);gy=np.zeros_like(z,dtype=np.float32)
 gx[:,1:-1]=(z[:,2:]-z[:,:-2])/(2*dx)
 gy[1:-1,:]=(z[:-2,:]-z[2:,:])/(2*dy) # north-positive
 slope=np.degrees(np.arctan(np.hypot(gx,gy))).astype(np.float32)
 # downslope azimuth clockwise from grid north, east=90; flats nodata
 aspect=(np.degrees(np.arctan2(-gx,-gy))+360)%360
 aspect=aspect.astype(np.float32)
 aspect[(~m3)|(slope<1e-4)]=NOD
 slope[~m3]=NOD
 # 150 m nominal, round to 5 pixels at 30m
 k=max(3,int(round(150/(0.5*(dx+dy))))|1)
 full=(uniform_filter(m,size=k,mode='constant',cval=0)*k*k >= k*k-0.01)&valid
 lo=minimum_filter(np.where(valid,dem,np.inf),size=k,mode='constant',cval=np.inf)
 hi=maximum_filter(np.where(valid,dem,-np.inf),size=k,mode='constant',cval=-np.inf)
 relief=(hi-lo).astype(np.float32)
 mean=uniform_filter(z,size=k,mode='constant',cval=0)
 mean2=uniform_filter(z*z,size=k,mode='constant',cval=0)
 std=np.sqrt(np.maximum(mean2-mean*mean,0)).astype(np.float32)
 relief[~full]=NOD;std[~full]=NOD
 return dict(slope=slope,aspect=aspect,local_relief=relief,roughness_std=std,gradient_east=gx,gradient_north=gy,derivative_valid=m3,window_valid=full,window_pixels=k)

@njit(cache=False)
def cast_shadow(z,valid,dx_m,dy_m,alt_deg,az_deg,max_dist,planet_radius):
 h,w=z.shape
 out=np.full((h,w),255,np.uint8)
 alt=np.radians(alt_deg)
 az=np.radians(az_deg)
 # march in METRES along the Sun azimuth, then convert to columns/rows with each axis' own cell size
 step_m=min(dx_m,dy_m)
 dx=np.sin(az)*step_m/dx_m;dy=-np.cos(az)*step_m/dy_m  # rows positive south
 steps=int(max_dist/step_m)
 tanalt=np.tan(alt)
 for y in range(h):
  for x in range(w):
   if not valid[y,x]:continue
   occluded=False;unknown=False
   for t in range(1,steps+1):
    xx=int(np.floor(x+dx*t+0.5));yy=int(np.floor(y+dy*t+0.5))
    if xx<0 or yy<0 or xx>=w or yy>=h or not valid[yy,xx]:
     unknown=True;break
    distance=t*step_m
    # local tangent curvature approximate: distant ground sinks below tangent
    height=z[yy,xx]-distance*distance/(2*planet_radius)
    if height>z[y,x]+distance*tanalt:
     occluded=True;break
   if occluded:out[y,x]=1
   elif unknown:out[y,x]=255
   else:out[y,x]=0
 return out

def run_tests():
 tests=[]
 def check(name,test):tests.append(dict(test=name,passed=bool(test)))
 z=np.tile(np.arange(30,dtype=np.float32)*0.1*30,(30,1))
 t=terrain(z,np.ones(z.shape,bool),30,30)
 check('known 10 percent eastward ramp slope',np.allclose(t['slope'][5:-5,5:-5],np.degrees(np.arctan(.1)),atol=.001))
 check('downslope of rising east surface is west (270)',np.allclose(t['aspect'][5:-5,5:-5],270,atol=.001))
 flat=np.zeros((70,70),np.float32);valid=np.ones_like(flat,bool)
 for altitude in ALTITUDES:
  s=cast_shadow(flat,valid,30.0,30.0,altitude,90,300,R_MARS)
  check(f'flat unobstructed interior {altitude} deg',np.all(s[15:55,15:50]==0))
  check(f'boundary unresolved {altitude} deg',np.all(s[:,65:]==255))
 flat[30,35]=80
 # source at col 20, to east obstacle at 35, 450m; 5deg projected ray 39m
 s=cast_shadow(flat,valid,30.0,30.0,5,90,600,R_MARS)
 check('synthetic barrier creates shadow westward',s[30,20]==1)
 check('synthetic barrier reverse sun unoccluded',cast_shadow(flat,valid,30.0,30.0,5,270,600,R_MARS)[30,20]==0)
 flat[30,35]=0;valid[30,35]=False
 check('missing ray cell is unresolved',cast_shadow(flat,valid,30.0,30.0,5,90,600,R_MARS)[30,20]==255)
 # non-square cells: a 10 percent northward ramp sampled on 30 m x 40 m cells must still read 10 percent
 zn=np.tile((np.arange(30,dtype=np.float32)[::-1]*0.1*40)[:,None],(1,30))
 tn=terrain(zn,np.ones(zn.shape,bool),30,40)
 check('non-square cells: 10 percent northward ramp slope',np.allclose(tn['slope'][5:-5,5:-5],np.degrees(np.arctan(.1)),atol=.001))
 check('non-square cells: downslope of rising north surface is south (180)',np.allclose(tn['aspect'][5:-5,5:-5],180,atol=.001))
 flat2=np.zeros((70,70),np.float32);valid2=np.ones_like(flat2,bool);flat2[20,30]=80
 # obstacle 15 rows north = 600 m on 40 m rows; at 5 deg an 80 m wall shades out to ~914 m
 check('non-square cells: northern barrier shades at true metric distance',cast_shadow(flat2,valid2,30.0,40.0,5,0,900,R_MARS)[35,30]==1)
 flat2[20,30]=40
 # 40 m wall shades only ~457 m: the same cell 600 m away must now be clear (would be shaded if rows were assumed 30 m)
 check('non-square cells: barrier beyond metric shadow length is clear',cast_shadow(flat2,valid2,30.0,40.0,5,0,900,R_MARS)[35,30]==0)
 dump(Path('reports/verification_tests.json'),{'tests':tests,'all_passed':all(t['passed'] for t in tests)})
 if not all(t['passed'] for t in tests):raise RuntimeError('Test failures: '+str([t for t in tests if not t['passed']]))
 return tests

def png_preview(arr,path,title,cmap='terrain',vmin=None,vmax=None):
 a=np.asarray(arr,dtype=float);a[(a==NOD)|(~np.isfinite(a))]=np.nan
 fig,ax=plt.subplots(figsize=(7,5))
 im=ax.imshow(a,cmap=cmap,vmin=vmin,vmax=vmax,interpolation='nearest')
 ax.set(title=title,xlabel='Raster column',ylabel='Raster row');fig.colorbar(im,ax=ax,label='m' if 'elevation' in title.lower() or 'relief' in title.lower() else ('degrees' if 'slope' in title.lower() else 'category / value'))
 fig.tight_layout();fig.savefig(OUT/path,dpi=115);plt.close(fig)

def run_mola(paths,hi_records):
 img=INPUT/'megt44n000hb.img';lbl=INPUT/'megt44n000hb.lbl'
 text=label_text(lbl)
 for expected in ['LINES                        = 5632','LINE_SAMPLES                 = 11520','SAMPLE_TYPE                  = MSB_INTEGER','SAMPLE_BITS                  = 16']:
  assert expected in text, f'Unexpected MOLA label: {expected}'
 assert img.stat().st_size==5632*11520*2
 # explicit PDS big endian signed integer; no GDAL ungrounded guessing
 raster=np.memmap(img,mode='r',dtype='>i2',shape=(5632,11520))
 n=0;mn=32767;mx=-32768;zero_count=0
 for y in range(0,5632,256):
  a=np.asarray(raster[y:y+256,:]);n+=a.size;mn=min(mn,int(a.min()));mx=max(mx,int(a.max()));zero_count+=int(np.count_nonzero(a==0))
 tr=Affine(1/128,0,0,0,-1/128,44)
 # IAU2000 planetocentric Mars geographic; radius as provided by label (spherical 3396km)
 crs='+proj=longlat +a=3396000 +b=3396000 +no_defs +type=crs'
 # Small independent context around HiRISE, not artificially high res; labeled fixed geographic extent
 # HiRISE label coordinates around 18N, 78E: include a 1.5deg x 1.5deg region
 west,east,south,north=77.5,79.0,17.5,19.0
 y0=round((44-north)*128);y1=round((44-south)*128)
 x0=round(west*128);x1=round(east*128)
 arr=np.asarray(raster[y0:y1,x0:x1],dtype=np.int16)
 save_raster('processed/common/MOLA_regional_context_128ppd.tif',arr,tr*Affine.translation(x0,y0),crs,nodata=None,description='MOLA topography relative to IAU2000 GMM3 areoid; original native grid')
 # global overview 8x nearest, retains a coarse context only, not derivative input
 ov=np.asarray(raster[::8,::8],dtype=np.int16)
 save_raster('processed/common/MOLA_tile_overview_16ppd.tif',ov,tr*Affine.scale(8,8),crs,nodata=None,description='MOLA sampled overview; not used for local obstacle shadows')
 d=dict(source=img.name,sha256=sha256(img),label_sha256=sha256(lbl),dimensions=[5632,11520],dtype='big-endian signed int16',scale=1,offset=0,unit='m above MOLA GMM3 IAU2000 areoid',projection='simple cylindrical geographic planetocentric 0-90E 0-44N',resolution_pixels_per_degree=128,count=n,minimum_m=mn,maximum_m=mx,zero_is_valid=True,zero_cells=zero_count,contains_interpolated_bins=True,source_label=text,extracted_context_bbox_lonlat=[west,south,east,north],overview_resampling='nearest decimation x8')
 dump(Path('metadata/MOLA_metadata.json'),{k:v for k,v in d.items() if k!='source_label'})
 (OUT/'metadata/MOLA_original_label.lbl').write_text(text,encoding='utf-8')
 png_preview(arr,'figures/MOLA_regional_elevation.png','MOLA regional elevation (m)')
 return d

def process_hirise(p,record):
 name=p.stem
 with rasterio.open(p) as src:
  win,approx=choose_window(src)
  original=src.read(1,window=win,masked=True)
  valid=(~np.ma.getmaskarray(original))&np.isfinite(np.asarray(original.data))
  data=np.where(valid,np.asarray(original.data),NOD).astype(np.float32)
  transform=src.window_transform(win)
  save_raster(f'processed/common/{name}_DEM_native_2m.tif',data,transform,src.crs)
  save_raster(f'processed/common/{name}_valid_native.tif',valid.astype(np.uint8),transform,src.crs,nodata=None)
  # No interpolation or filling; all modified-cell flags zero.
  save_raster(f'processed/common/{name}_modified_cells.tif',np.zeros(data.shape,np.uint8),transform,src.crs,nodata=None)
  width=max(1,round(data.shape[1]*abs(transform.a)/ANALYSIS_M))
  height=max(1,round(data.shape[0]*abs(transform.e)/ANALYSIS_M))
  tr=transform*Affine.scale(data.shape[1]/width,data.shape[0]/height)
  agg=np.full((height,width),NOD,np.float32)
  # source nodata -9999, average only valid values; any low-coverage cells explicitly invalidated
  reproject(source=data,destination=agg,src_transform=transform,src_crs=src.crs,src_nodata=NOD,dst_transform=tr,dst_crs=src.crs,dst_nodata=NOD,resampling=Resampling.average)
  frac=np.zeros((height,width),np.float32)
  reproject(source=valid.astype('float32'),destination=frac,src_transform=transform,src_crs=src.crs,dst_transform=tr,dst_crs=src.crs,resampling=Resampling.average)
  ok=(frac>=0.999)&(agg!=NOD)&np.isfinite(agg)
  agg[~ok]=NOD
  save_raster(f'processed/common/{name}_DEM_analysis_30m.tif',agg,tr,src.crs)
  save_raster(f'processed/common/{name}_valid_analysis.tif',ok.astype(np.uint8),tr,src.crs,nodata=None)
  save_raster(f'processed/common/{name}_valid_fraction_analysis.tif',frac.astype(np.float32),tr,src.crs,nodata=None)
  base=dict(source=name,window_raw=dict(col=int(win.col_off),row=int(win.row_off),width=int(win.width),height=int(win.height)),estimated_mask_density_for_selection=approx,actual_native_valid_pct=100*float(valid.mean()),native_grid_dimensions=list(data.shape),native_pixel_m=[abs(transform.a),abs(transform.e)],native_height=basic_stats(data,valid,'m'),native_modified_cells=0)
  return derive_products(name,agg,ok,tr,src.crs,base)

def lonlat(crs,x,y):
 # inverse of the product's own spherical equirectangular projection (planetocentric, east-positive)
 d=crs.to_dict();R=float(d['R'])
 return float(d['lon_0'])+math.degrees(x/(R*math.cos(math.radians(float(d['lat_ts']))))),math.degrees(y/R)

def derive_products(name,agg,ok,tr,crs,base):
 """Everything that depends only on the 30 m analysis DEM: terrain metrics, illumination scenarios, statistics."""
 dx=float(abs(tr.a));dy=float(abs(tr.e))
 terrain_out=terrain(agg,ok,dx,dy)
 for key in ('slope','aspect','local_relief','roughness_std'):
  save_raster(f'processed/terrain/{name}_{key}.tif',terrain_out[key],tr,crs)
 save_raster(f'processed/terrain/{name}_derivative_valid.tif',terrain_out['derivative_valid'].astype(np.uint8),tr,crs,nodata=None)
 png_preview(agg,f'figures/{name}_elevation.png',f'{name} elevation (m)')
 png_preview(terrain_out['slope'],f'figures/{name}_slope.png',f'{name} slope (degrees)',cmap='viridis',vmin=0)
 physical=terrain_out['derivative_valid']
 gx=terrain_out['gradient_east'];gy=terrain_out['gradient_north']
 scenarios=[]
 for alt in ALTITUDES:
  for az in AZIMUTHS:
   cast=cast_shadow(agg,ok,dx,dy,alt,az,MAX_SHADOW_M,R_MARS)
   a=np.deg2rad(alt);b=np.deg2rad(az)
   cos_inc=(np.sin(a)-np.cos(a)*(gx*np.sin(b)+gy*np.cos(b)))/np.sqrt(1+gx*gx+gy*gy)
   self_shadow=physical&(cos_inc<=0)
   cos_inc=np.where(physical,np.clip(cos_inc,-1,1),NOD).astype('float32')
   self_mask=np.full(cast.shape,255,np.uint8);self_mask[physical]=self_shadow[physical].astype(np.uint8)
   tag=f'{name}_alt{alt:02d}_az{az:03d}'
   save_raster(f'processed/illumination/{tag}_cast_shadow.tif',cast,tr,crs,nodata=255)
   save_raster(f'processed/illumination/{tag}_self_shadow.tif',self_mask,tr,crs,nodata=255)
   save_raster(f'processed/illumination/{tag}_cos_incidence.tif',cos_inc,tr,crs)
   count_shadow=int(np.count_nonzero(cast==1));count_clear=int(np.count_nonzero(cast==0));count_unknown=int(np.count_nonzero(cast==255))
   # combined state: a cell is lit only when BOTH tests say so; shadowed when EITHER says so; otherwise unresolved
   shadowed=(cast==1)|(self_mask==1);lit=(cast==0)&(self_mask==0)
   n_sh=int(shadowed.sum());n_lit=int(lit.sum());n_res=n_sh+n_lit
   scenarios.append(dict(patch=name,altitude_deg=alt,azimuth_deg=az,cast_shadow_cells=count_shadow,cast_clear_cells=count_clear,cast_unresolved_cells=count_unknown,self_shadow_cells=int(self_shadow.sum()),combined_shadowed_cells=n_sh,combined_lit_cells=n_lit,combined_unresolved_cells=int(cast.size-n_res),shadowed_fraction_of_resolved=round(n_sh/n_res,6) if n_res else None,resolved_fraction_of_patch=round(n_res/cast.size,6),max_ray_m=MAX_SHADOW_M,azimuth_reference='grid north clockwise',classification='cast: 1 shadow, 0 clear within 1200m, 255 unresolved missing/boundary; combined: shadowed = cast or self shadow, lit = cast clear and facing Sun'))
 dump(Path(f'metadata/{name}_solar_scenarios.json'),scenarios)
 with (OUT/'reports'/(name+'_sun_summary.csv')).open('w',newline='') as f:
  writer=csv.DictWriter(f,fieldnames=list(scenarios[0]));writer.writeheader();writer.writerows(scenarios)
 b=rasterio.transform.array_bounds(agg.shape[0],agg.shape[1],tr)
 lon0,lat0=lonlat(crs,b[0],b[1]);lon1,lat1=lonlat(crs,b[2],b[3])
 stat=dict(base)
 stat.update(analysis_valid_pct=100*float(ok.mean()),analysis_grid_dimensions=list(agg.shape),analysis_pixel_m=[dx,dy],analysis_pixel_note='[east-west, north-south]; cells are not square and each axis uses its own size',analysis_height=basic_stats(agg,ok,'m'),
  terrain_stats=dict(slope=basic_stats(terrain_out['slope'],terrain_out['slope']!=NOD,'deg'),aspect=circular_stats(terrain_out['aspect'],terrain_out['aspect']!=NOD),local_relief=basic_stats(terrain_out['local_relief'],terrain_out['local_relief']!=NOD,'m'),roughness_std=basic_stats(terrain_out['roughness_std'],terrain_out['roughness_std']!=NOD,'m')),
  slope_distribution=slope_distribution(terrain_out['slope'],terrain_out['slope']!=NOD),
  roughness_window_m=[terrain_out['window_pixels']*dx,terrain_out['window_pixels']*dy],pixel_area_km2=dx*dy/1e6,valid_analysis_area_km2=int(ok.sum())*dx*dy/1e6,
  location=dict(center_lon_east_deg=(lon0+lon1)/2,center_lat_deg=(lat0+lat1)/2,bounds_lonlat_deg=[lon0,lat0,lon1,lat1],bounds_projected_m=list(b),note='planetocentric latitude, east-positive longitude, inverted from the product equirectangular projection'),
  vertical_reference='Mars 2000 equipotential datum (HiRISE DTM label)',number_of_shadow_scenarios=len(scenarios))
 dump(Path(f'reports/{name}_patch_statistics.json'),stat)
 return stat,scenarios

def upgrade_stats(d):
 # convert the first-release key names (min_m/max_m/... used for every unit) to count/unit/min/max/mean/std
 if d is None or 'min' in d:return d
 return dict(count=d['count'],unit='m',min=d['min_m'],max=d['max_m'],mean=d['mean_m'],std=d['std_m'])

def reprocess_from_analysis():
 """Derive mode: rebuild all DEM-derived products from the stored 30 m analysis DEMs (sources not required)."""
 patches=[];scenes=[]
 for dem in sorted((OUT/'processed/common').glob('*_DEM_analysis_30m.tif')):
  name=dem.name[:-len('_DEM_analysis_30m.tif')]
  with rasterio.open(dem) as src:agg=src.read(1);tr=src.transform;crs=src.crs
  with rasterio.open(OUT/f'processed/common/{name}_valid_analysis.tif') as src:ok=src.read(1).astype(bool)
  old=json.loads((OUT/f'reports/{name}_patch_statistics.json').read_text())
  with rasterio.open(OUT/f'processed/common/{name}_DEM_native_2m.tif') as src:npx=[abs(src.transform.a),abs(src.transform.e)]
  base={k:old[k] for k in ('source','window_raw','estimated_mask_density_for_selection','actual_native_valid_pct','native_grid_dimensions')}
  base.update(native_pixel_m=npx,native_height=upgrade_stats(old['native_height']),native_modified_cells=old['native_modified_cells'])
  patch,scene=derive_products(name,agg,ok,tr,crs,base)
  patches.append(patch);scenes.extend(scene)
 return patches,scenes

def verify_outputs():
 # actually reopen every GeoTIFF and verify at least metadata/nodata/grids; key masks validated independently
 paths=list((OUT/'processed').rglob('*.tif'))
 bad=[];n=0
 for p in paths:
  with rasterio.open(p) as s:
   n+=1
   if not s.crs or s.width<1 or s.height<1 or s.transform.a<=0 or s.transform.e>=0:bad.append(str(p))
   if p.name.endswith('_slope.tif'):
    x=s.read(1,masked=True)
    if np.any((x.compressed()<0)|(x.compressed()>90)):bad.append(str(p)+':slope_range')
   if p.name.endswith('_cast_shadow.tif'):
    a=s.read(1)
    if not np.isin(a,[0,1,255]).all():bad.append(str(p)+':cast_values')
   if p.name.endswith('_self_shadow.tif'):
    a=s.read(1)
    if not np.isin(a,[0,1,255]).all():bad.append(str(p)+':self_values')
   if p.name.endswith('_cos_incidence.tif'):
    x=s.read(1,masked=True).compressed()
    if np.any((x<-1)|(x>1)):bad.append(str(p)+':cos_range')
 if bad:raise RuntimeError('Invalid output rasters: '+str(bad))
 result=dict(reopened_geotiffs=n,errors=bad,valid=True,checks=['raster opens','CRS present','positive x pixel','north-up y','valid slope range','cast and self shadow class codes','cos incidence within [-1,1]'])
 dump(Path('reports/geotiff_reopen_validation.json'),result)
 return result

def frontend(stats,mola):
 features=[]
 for s in stats:
  name=s['source']
  with rasterio.open(OUT/f'processed/common/{name}_DEM_analysis_30m.tif') as src:
   bb=src.bounds
   # projected XY Mars-specific, never Earth basemap
   geometry=dict(type='Polygon',coordinates=[[[bb[0],bb[1]],[bb[2],bb[1]],[bb[2],bb[3]],[bb[0],bb[3]],[bb[0],bb[1]]]])
   features.append(dict(type='Feature',geometry=geometry,properties=dict(patch=name,crs_wkt=src.crs.to_wkt(),valid_area_km2=s['valid_analysis_area_km2'],bounds_lonlat_deg=s['location']['bounds_lonlat_deg'],lonlat_note='planetocentric, east-positive, Mars; NOT Earth WGS84')))
 dump(Path('frontend/patch_bounds_mars_projected.geojson'),dict(type='FeatureCollection',features=features,warning='Per-feature Mars equirectangular CRS differs. Not Earth GeoJSON; do not use EPSG:4326 or Earth maps.'))
 dump(Path('frontend/dashboard_data.json'),dict(project='Mars planetary terrain and geometry benchmark',planet='Mars',patches=stats,mola=dict(extent_lonlat=mola['extracted_context_bbox_lonlat'],extent_order='[west, south, east, north]',source=mola['source']),scenario_altitudes_deg=ALTITUDES,scenario_azimuths_grid_north_deg=AZIMUTHS,basemap='NONE: Mars CRS required',preview_images=[str(p.relative_to(OUT)) for p in sorted((OUT/'figures').glob('*.png'))],disclaimer='Scenarios hypothetical; no Earth data included; no actual solar ephemerides; unresolved shadows must not be counted clear.'))

def write_docs(stats,mola):
 sources={'HiRISE DTM specification':'https://hirise.lpl.arizona.edu/dtm/about.php','HiRISE GDAL/NoData guidance':'https://hirise.lpl.arizona.edu/dtm/howto.php','MOLA MEGDR native tiling':'https://pds-geosciences.wustl.edu/missions/mgs/megdr.html','MOLA IAU2000 compatibility':'https://pds-geosciences.wustl.edu/missions/mgs/mola.html'}
 dump(Path('metadata/processing_parameters.json'),dict(inputs='original untouched; SHA256 in input_quality_before.json and MOLA_metadata.json',sources=sources,HI_RISE_vertical='Mars 2000 equipotential elevation metres from embedded PDS NOTE',MOLA_vertical='GMM3 areoid IAU2000 from PDS label; not assumed exactly interchangeable with HiRISE',processing='select contiguous independent most valid ~2.4 x 3.0km patches; native 2m preserved; 30m approximate analysis by average; only cells with >=99.9% valid raw footprint retained; no sink filling smoothing NoData filling or outlier removal',roughness='population standard deviation of all 5x5 DEM heights (~150m) as sqrt(mean(z²)-mean(z)²); local relief=max-min same full-valid window',slope='central differences dz/dE over the east-west cell size and dz/dN over the north-south cell size (cells are ~29.91 x 29.99 m, not square); slope=atan(hypot(gradients)); degrees. Baseline is two cells (~60 m): slope is scale dependent',slope_distribution='1-degree histogram counts, percentiles and fraction steeper than fixed thresholds are stored in reports/*_patch_statistics.json; compare distributions, not only means',statistics_keys='count/unit/min/max/mean/std with an explicit unit; aspect uses circular statistics',aspect='downslope azimuth clockwise from grid north, east=90; flats and invalid 3x3 -> -9999',terrain_valid='all 3x3 stencil cells valid; local relief and roughness require fully valid 5x5 neighborhood',sun_altitudes_deg=ALTITUDES,sun_azimuths_deg=AZIMUTHS,solar_azimuth_reference='grid north, clockwise; local grid is equirectangular Mars, grid/true north may differ and has not been converted',shadow='discrete nearest-cell horizon ray tracing, marched in metres with per-axis cell size, to max 1200m using planet local radius 3396km and curvature correction -d²/(2R). Occlusion 1, definitely ray-unoccluded in 1200m 0, missing/exit 255. This is partial horizon, not infinite-range visibility.',shadow_limitations='unknown at edge and missing data; occlusion beyond 1200m untested; subpixel obstacles excluded; MOLA not used for obstacle completion; no permanent shadow inference',self_shadow='negative surface-normal dot sun direction; independent of cast-shadow',combined_illumination='shadowed = cast shadow OR self shadow; lit = cast clear AND facing the Sun; everything else unresolved. Shadow fractions are quoted over resolved cells only',incidence='cos of solar incidence angle on 3x3-valid local normal; NOT brightness, camera imagery, dust or reflectance',scale_note='30m posts do not imply identical point spread function, instrument resolution, vertical error or effective resolution to NASADEM 30m',scenario_note='hypothetical Sun, not time-specific; Mars Sun can be higher than polar Moon Sun',earth_requirements='Earth NASADEM elevation incl vertical datum and CRS, native effective resolution, comparable window footprints and valid masks, identical solar geometry and shadow distance/uncertainty convention, independent comparisons after datum compatibility review',crs_note='Mars-specific equirectangular CRS with radius 3394839.8133163 m in HiRISE headers; NO Earth UTM. MOLA sphere label radius 3396000m; no forced alignment.'))
 (OUT/'README.md').write_text('''# NASA Space Apps — Mars terrain and lighting preprocessing

## Executed work
Two **independent** HiRISE DTM patches (centres near 18.76N 78.15E and 18.27N 78.20E, planetocentric east-positive; both lie east of Jezero crater, outside its rim) are selected by valid-data density, preserved at their native ~2.019m pixel scale, and aggregated to ~30m using valid-data-aware averages. No missing data are filled. The two DTMs are geographically separated and have different equirectangular centers; **never mosaic** them as adjacent. All original source inputs remain outside this output directory; SHA256 hashes are recorded. Source files are not bundled in this deliverable.

## Files and semantics
- `processed/common`: native and 30m DEM, validity masks, native modified-cell masks (all 0), 30m source-valid-fraction; MOLA context for the Jezero region (77.5-79.0E, 17.5-19.0N) at **native 128 px/degree**, plus a coarse whole-tile preview. MOLA is **not** terrain merged with HiRISE.
- `processed/terrain`: quantitative slope degrees, downslope aspect degrees clockwise from **grid north** (flat = NoData), 150m local elevation relief (max-minus-min, m), 150m roughness (population std of elevations, m), 3x3 derivative-valid mask.
- `processed/illumination`: per patch, 24 hypothetical Sun scenarios (elevation 5,15,30 degrees x azimuth 0..315 in 45degree steps). `cast_shadow` 1=terrain occluded, 0=no barrier **within 1200m and valid ray**, 255=unresolved due to data border/void. `self_shadow` 1=facet faces away, 0=faces Sun, 255=unavailable local derivative. `cos_incidence` normalized incidence geometry; -9999 NoData. Cast shadows and self-shadow are separate rasters; the scenario summaries also give the combined state (shadowed = either, lit = both clear) and the shadowed fraction **of resolved cells**.
- `metadata`: copied non-large PDS labels, per-product georeferencing, source checksums, processing options and scientific cautions.
- `reports`: source quality inspection before/after, real numeric patch stats and scene summaries, actual tests and GeoTIFF reopen validation.
- `figures`: visual previews, not replacements for data layers.
- `frontend`: JSON dashboard, separate Mars-projected bounding polygons with **per-feature CRS WKT**, and preview PNGs under `figures`. These polygons **cannot be drawn on Earth Web Mercator**. The `.geojson` extension is solely a convenient feature container: its projected coordinate interpretation is Mars-specific and not RFC 7946 WGS84.
- `manifest.csv`: inventory with file size, purpose.

## Scientific limitations
HiRISE label: elevations in metres above **Mars 2000 equipotential datum**. MOLA label: topography relative to **GMM3 areoid** in IAU2000. Coincident-looking values are **not proof of identical vertical reference**, and their independent projection representations differ; no vertical-offset harmonization or MOLA infill attempted. MOLA gridded cells include **interpolated bins**, not all direct laser hits. Negative elevations are valid. No outlier correction, smoothing, or fills were carried out. Subpixel rocks, dust, minerals, camera response, and geographic permanent darkness are **not inferred**.

Native HiRISE 2m pixel spacing is not same as effective resolution; 30m aggregation is for approximate NASADEM pixel spacing, **not** an equal-resolution claim. Some border pixels cannot yield reliable normals or shadows. Ray search capped at 1200m and casts discrete cell-center approximations; a clear result does NOT certify no shadows from more distant obstacles. Solar azimuths are relative to local raster grid north, not calibrated true-north or Sun ephemerides. R=3396 km approximation with curvature correction; no atmospheric refraction. Mars is not lunar south pole. All Sun angles are explicitly hypothetical. Only limited ray visibility can be guaranteed; 255 code means unresolved, not illuminated.

## Reproduction and integration
Run `python pipeline.py`. With the `Mars/` source directory beside this folder it rebuilds everything; without it (the sources are not bundled) it runs in *derive* mode and rebuilds every product that depends only on the stored 30m analysis DEM (terrain, illumination, statistics, frontend, manifest). Requirements: `numpy`, `rasterio`, `scipy`, `numba`, `matplotlib`, `nbformat`, `nbclient`. Notebook is a reproducible launcher; JSON outputs report what was truly executed. To show rasters on Mars, use a planetary GIS and the product-specific projection WKT; avoid Earth leaflet defaults. The frontend can consume `frontend/dashboard_data.json`, `reports/*_sun_summary.csv`, and preview paths in the JSON. Raw rasters can be served as Cloud Optimized GeoTIFF **after** an optional separate COG conversion; current files are tiled/compressed regular GeoTIFFs. No Earth inputs were provided: there is no final cross-planet similarity rank.

## Official references
- https://hirise.lpl.arizona.edu/dtm/about.php
- https://hirise.lpl.arizona.edu/dtm/howto.php
- https://pds-geosciences.wustl.edu/missions/mgs/megdr.html
- https://pds-geosciences.wustl.edu/missions/mgs/mola.html

## Corrections in this revision\n- Slope, aspect, incidence and the shadow ray-march now use the true east-west (~29.91m) and north-south (~29.99m) cell sizes; the first release used the east-west size on both axes.\n- Statistics carry an explicit `unit` (slope was labelled `_m`); aspect uses circular statistics.\n- Slope distributions (histogram, percentiles, exceedance) and patch longitude/latitude were added.\n- Numba cache files are no longer part of the deliverable or the manifest.\n\n## Output meaning and validation
See `metadata/processing_parameters.json`, `reports/verification_tests.json`, and `reports/geotiff_reopen_validation.json`. No independent laboratory or planetary GIS science validation has been claimed.
''',encoding='utf8')

LOG=[]
def say(*a):
 line=' '.join(str(x) for x in a);LOG.append(line);print(line,flush=True)

def main():
 start=time.time()
 files=sorted(INPUT.glob('DTEED*.IMG'))
 full=len(files)==2
 if not full and not list((OUT/'processed/common').glob('*_DEM_analysis_30m.tif')):
  raise RuntimeError(f'Expected two HiRISE DTM input files in {INPUT} (found {len(files)}) or stored 30 m analysis DEMs to derive from')
 say('mode:','full (from PDS sources)' if full else 'derive (sources absent; rebuilding DEM-derived products from stored 30 m analysis DEMs)')
 if full:
  say('1/6 Native sources inspection + hashes')
  inspections=[inspect_hirise(p) for p in files]
  dump(Path('reports/input_quality_before.json'),inspections)
  for p in files:
   (OUT/'metadata'/(p.stem+'_original_pds_label.txt')).write_text(label_text(p),encoding='utf8')
  say('2/6 MOLA strict binary parse + independent context')
  mola=run_mola([],inspections)
 else:
  say('1/6 skipped (source-level report kept as is)');say('2/6 skipped (MOLA products kept as is)')
  mola=json.loads((OUT/'metadata/MOLA_metadata.json').read_text())
  # stored order was [west, south, east, north]; keep it explicit
 say('3/6 Synthetic slope/cast-shadow tests')
 tests=run_tests()
 say('4/6 HiRISE terrain and 48 casts')
 patches=[];scenes=[]
 if full:
  for p,rec in zip(files,inspections):
   patch,scene=process_hirise(p,rec)
   patches.append(patch);scenes.extend(scene)
 else:
  patches,scenes=reprocess_from_analysis()
 for patch in patches:
  say('  ',patch['source'],'native valid%',round(patch['actual_native_valid_pct'],2),'30m valid%',round(patch['analysis_valid_pct'],2),'slope mean deg',round(patch['terrain_stats']['slope']['mean'],3))
 say('5/6 Reports, frontend, verification')
 frontend(patches,mola);write_docs(patches,mola)
 dump(Path('reports/quality_after.json'),dict(cleaning_actions=[],all_native_modified_cells=0,source_values_retained=True,negative_elevations_preserved=True,validity_rule='>=99.9% of source footprint, otherwise NoData',patches=patches,notes='suspicious local jumps are reported for source rasters but not automatically altered; full data QA streamed in blocks; 2m DEM outputs are just patches, not entire raw products.'))
 verify=verify_outputs()
 rows=[]
 for p in sorted(OUT.rglob('*')):
  # build caches are not products
  if p.is_file() and p.name not in('manifest.csv','pipeline_execution.log') and '__pycache__' not in p.parts and '.ipynb_checkpoints' not in p.parts:
   rel=str(p.relative_to(OUT));category=rel.split('/')[0]
   rows.append(dict(path=rel,bytes=p.stat().st_size,role=category))
 rows.append(dict(path='reports/pipeline_execution.log',bytes='',role='reports'))
 with (OUT/'manifest.csv').open('w',newline='') as f:
  w=csv.DictWriter(f,fieldnames=['path','bytes','role']);w.writeheader();w.writerows(rows)
 say('6/6 Final',json.dumps(dict(tests=len(tests),test_passed=all(t['passed'] for t in tests),reopened_geotiffs=verify['reopened_geotiffs'],output_files=len(rows))))
 (OUT/'reports/pipeline_execution.log').write_text('\n'.join(LOG)+'\n',encoding='utf-8')

if __name__=='__main__':main()
