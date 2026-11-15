"""Earth polar DSM processing, version 1.0.0. Run: python run_earth_polar.py"""
import os, json, csv, hashlib, math, shutil, sys, platform
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import rasterio
from rasterio.warp import reproject,Resampling,transform_bounds
from rasterio.transform import from_origin
from rasterio.windows import Window
from scipy.ndimage import map_coordinates, uniform_filter, maximum_filter, minimum_filter
from pyproj import CRS, Transformer, Geod
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt

VERSION='1.0.0'; PIX=80.; CORE_N=80; CTX_N=200; SEARCH=6400.; STEP=80.; RAD=6371008.8
ROOT=Path('/mnt/data/Earth_Polar_Processed'); INPUT=Path('/mnt/data/earth_inputs')
SITES=[('Haughton_tile','N75_00_W090_00',32616,'Haughton-region tile; exact crater footprint unverified'),('Antarctic_tile','S78_00_E162_00',32758,'East Antarctica tile; Dry Valleys location not established'),('North_Greenland','N82_00_W032_00',32625,'Northern Greenland candidate; Peary Land and bare ground unverified')]
SUN=[(alt,az) for alt in (.5,1.,1.5) for az in range(0,360,45)]
SETTINGS={'pixel_m':PIX,'core_shape':[CORE_N,CORE_N],'context_shape':[CTX_N,CTX_N],'search_m':SEARCH,'ray_step_m':STEP,'altitudes_deg':[.5,1.,1.5],'azimuths_true_north_deg':list(range(0,360,45)),'curvature_radius_m':RAD,'roughness_window_cells':5,'relief_window_cells':5,'resampling':'bilinear','code_version':VERSION}
def ensure():
 for p in ['processed/common','processed/terrain','processed/illumination','metadata','reports','figures','frontend','code']:(ROOT/p).mkdir(parents=True,exist_ok=True)
def writejson(p,x):Path(p).write_text(json.dumps(x,ensure_ascii=False,indent=2,default=lambda z: float(z) if isinstance(z,np.floating) else int(z) if isinstance(z,np.integer) else str(z)),encoding='utf8')
def hashfile(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
 return h.hexdigest()
def raster(path,arr,aff,crs,nodata=None,units=None):
 if arr.dtype==np.bool_:arr=arr.astype('uint8')
 profile=dict(driver='GTiff',height=arr.shape[0],width=arr.shape[1],count=1,dtype=str(arr.dtype),crs=crs,transform=aff,compress='deflate',tiled=True,blockxsize=128,blockysize=128)
 if nodata is not None:profile['nodata']=nodata
 with rasterio.open(path,'w',**profile) as d:
  d.write(arr,1)
  if units:d.update_tags(1,units=units)
def pathrel(p):return str(Path(p).relative_to(ROOT)).replace('\\','/')
def full_stats(a):
 v=a[np.isfinite(a)];return {'count':int(v.size),'min':float(v.min()) if v.size else None,'max':float(v.max()) if v.size else None,'mean':float(v.mean()) if v.size else None,'std':float(v.std()) if v.size else None,'p05':float(np.percentile(v,5)) if v.size else None,'p50':float(np.median(v)) if v.size else None,'p95':float(np.percentile(v,95)) if v.size else None}
def shadow(dem,core,alt,az,step=STEP,rng=SEARCH,curvature=True):
 """0 illuminated, 1 cast-shadow, 2 unresolved. North-aligned metric grid.
    Conservative: if unknown terrain encountered before first blocking hit => unknown.
    Observers at DSM elevation. Pixel centers; bilinear sampling and curvature approximation.
 """
 y0=(dem.shape[0]-core)//2; x0=(dem.shape[1]-core)//2
 ys,xs=np.mgrid[y0:y0+core,x0:x0+core]; ground=dem[y0:y0+core,x0:x0+core];blocked=np.zeros(ground.shape,bool);unresolved=~np.isfinite(ground)
 a=math.radians(az);t=math.tan(math.radians(alt)); dist=np.arange(step,rng+step/2,step)
 for d in dist:
  # azimuth clockwise from true north; projected grid north adjusted at site externally via azimuth-grid-convergence
  rr=ys-np.cos(a)*d/PIX; cc=xs+np.sin(a)*d/PIX
  outside=(rr<0)|(rr>dem.shape[0]-1)|(cc<0)|(cc>dem.shape[1]-1)
  sample=map_coordinates(np.nan_to_num(dem,nan=-9999999.),[np.clip(rr,0,dem.shape[0]-1),np.clip(cc,0,dem.shape[1]-1)],order=1,mode='nearest')
  # sample with strict neighborhood validity, prevent NaN bridging
  validarr=np.isfinite(dem).astype('float32'); good=map_coordinates(validarr,[np.clip(rr,0,dem.shape[0]-1),np.clip(cc,0,dem.shape[1]-1)],order=1,mode='nearest')>.99999
  missing=outside|(~good)
  active=(~blocked)&(~unresolved)
  unresolved|=active&missing
  hit=active&(~missing)&(sample-(d*d/(2*RAD) if curvature else 0.)>ground+d*t+1e-5)
  blocked|=hit
 result=np.zeros(ground.shape,np.uint8);result[blocked]=1;result[unresolved]=2
 return result

def main():
 ensure(); reports=[]; dashboard=[]; geo=[]; cache=[]; tests={}
 for name,token,epsg,note in SITES:
  fs=list(INPUT.glob('*'+token+'*DEM.tif'));assert len(fs)==1,(name,fs);src=fs[0]
  sh=hashfile(src);fingerprint=hashlib.sha256((sh+json.dumps(SETTINGS,sort_keys=True)+str(epsg)).encode()).hexdigest()
  with rasterio.open(src) as ds:
   assert ds.crs.to_epsg()==4326 and ds.count==1
   cx=(ds.bounds.left+ds.bounds.right)/2; cy=(ds.bounds.bottom+ds.bounds.top)/2
   trans=Transformer.from_crs(4326,epsg,always_xy=True);xc,yc=trans.transform(cx,cy)
   affine=from_origin(xc-(CTX_N/2)*PIX,yc+(CTX_N/2)*PIX,PIX,PIX)
   dem=np.full((CTX_N,CTX_N),np.nan,np.float32)
   # Reproject windowed: only source window covering study area, not entire 4.3M-pixel raster
   geo_bounds=transform_bounds(epsg,4326,*rasterio.transform.array_bounds(CTX_N,CTX_N,affine),densify_pts=41)
   win=ds.window(*geo_bounds).round_offsets().round_lengths()
   win=win.intersection(Window(0,0,ds.width,ds.height))
   source=ds.read(1,window=win,masked=True).filled(np.nan).astype('float32')
   reproject(source,dem,src_transform=ds.window_transform(win),src_crs=ds.crs,dst_transform=affine,dst_crs=f'EPSG:{epsg}',src_nodata=np.nan,dst_nodata=np.nan,resampling=Resampling.bilinear)
   # full input streaming QA; avoid loading entire tile
   n=0; mn=float('inf');mx=-float('inf');invalid=0; zeros=0; suspicious=0
   for _,w in ds.block_windows(1):
    v=ds.read(1,window=w,masked=True);arr=np.asarray(v.filled(np.nan),dtype='float32');ok=np.isfinite(arr);n+=int(ok.sum());invalid+=int((~ok).sum());zeros+=int(np.count_nonzero(ok&(arr==0)));mn=min(mn,float(np.min(arr[ok])) if ok.any() else mn);mx=max(mx,float(np.max(arr[ok])) if ok.any() else mx)
    # high local differences flag only; inspect, do not correct
    suspicious+=int(np.count_nonzero((np.abs(np.diff(arr,axis=0))>100)&np.isfinite(np.diff(arr,axis=0))))
   geod=Geod(ellps='WGS84');_,_,dx=geod.inv(cx,cy,cx+ds.res[0],cy);_,_,dy=geod.inv(cx,cy,cx,cy+ds.res[1]);
   # UTM meridian convergence: angle of grid north east of true north, estimate in projected frame via geodesic north vector
   _,_,northlat=geod.fwd(cx,cy,0,1000);xn,yn=trans.transform(cx,northlat); true_north_grid_az=math.degrees(math.atan2(xn-xc,yn-yc))
   core0=(CTX_N-CORE_N)//2; sl=np.s_[core0:core0+CORE_N,core0:core0+CORE_N];core=dem[sl];coreaff=affine*rasterio.Affine.translation(core0,core0)
   valid=np.isfinite(core);validctx=np.isfinite(dem)
   common=ROOT/'processed/common';ter=ROOT/'processed/terrain';ill=ROOT/'processed/illumination'
   raster(common/f'{name}_context_dem_80m.tif',dem,affine,epsg,nodata=np.nan,units='m')
   raster(common/f'{name}_core_dem_80m.tif',core,coreaff,epsg,nodata=np.nan,units='m')
   raster(common/f'{name}_core_valid.tif',valid.astype('uint8'),coreaff,epsg,nodata=255,units='binary')
   raster(common/f'{name}_context_valid.tif',validctx.astype('uint8'),affine,epsg,nodata=255,units='binary')
   raster(common/f'{name}_core_modified.tif',np.zeros(core.shape,np.uint8),coreaff,epsg,nodata=255,units='binary')
   # Raster derivatives computed on common context once. Strict 5x5 validity for relief and roughness.
   dzdy,dzdx=np.gradient(dem,PIX,PIX) # row derivative south positive, dx east positive
   gy=-dzdy; gx=dzdx; slope=np.degrees(np.arctan(np.hypot(gx,gy))).astype('float32')
   aspect=(np.degrees(np.arctan2(gx,gy))+360)%360;aspect=np.where(np.hypot(gx,gy)>1e-8,aspect,np.nan).astype('float32')
   window=5;localmax=maximum_filter(np.nan_to_num(dem,nan=-1e9),size=window);localmin=minimum_filter(np.nan_to_num(dem,nan=1e9),size=window)
   relief=(localmax-localmin).astype('float32')
   # plane-detrended RMS residual roughness, 5x5 local least squares plane. Uses 2D linear detrending via uniform-filter moment identities.
   z=np.nan_to_num(dem,nan=0); zz=uniform_filter(z*z,size=window,mode='nearest'); zm=uniform_filter(z,size=window,mode='nearest');
   # covariance with offsets computed through shifts, all valid interior only
   ycgrid,xcgrid=np.mgrid[-2:3,-2:3]; sx=np.zeros_like(z);sy=np.zeros_like(z)
   for iy in range(-2,3):
    for ix in range(-2,3):
     shifted=np.roll(np.roll(z,-iy,axis=0),-ix,axis=1);sx+=ix*shifted/25.;sy+=iy*shifted/25.
   rough=np.sqrt(np.maximum(zz-zm*zm-(sx*sx+sy*sy)/2.,0.)).astype('float32')
   enough=minimum_filter(validctx.astype('uint8'),size=5,mode='constant',cval=0).astype(bool)
   for key,ar,unit in [('slope_deg',slope,'degree'),('aspect_deg',aspect,'degree_clockwise_from_grid_north'),('relief_400m',relief,'m'),('roughness_detrended_400m',rough,'m')]:
    v=ar[sl].copy();v[~enough[sl]]=np.nan
    raster(ter/f'{name}_{key}.tif',v,coreaff,epsg,nodata=np.nan,units=unit)
   scen=[]
   for alt,az in SUN:
    # true-north azimuth rotated into grid coordinates
    gridaz=az+true_north_grid_az
    mask=shadow(dem,CORE_N,alt,gridaz)
    f=ill/f'{name}_castshadow_alt{str(alt).replace(".","p")}_az{az:03d}.tif';raster(f,mask,coreaff,epsg,nodata=255,units='0=clear,1=cast_shadow,2=unresolved')
    k=int((mask==0).sum());b=int((mask==1).sum());u=int((mask==2).sum());
    scen.append({'altitude_deg':alt,'azimuth_true_north_deg':az,'azimuth_grid_north_deg':gridaz%360,'clear_pixels':k,'cast_shadow_pixels':b,'unresolved_pixels':u,'resolved_shadow_fraction':b/(b+k) if b+k else None,'fraction_of_all_core_pixels_unresolved':u/mask.size,'mask':pathrel(f)})
   ss={k:full_stats(a[sl][enough[sl]]) for k,a in [('slope_deg',slope),('local_relief_m',relief),('detrended_roughness_m',rough)]}
   ss['elevation_m']=full_stats(core)
   qa={'site':name,'source_filename':src.name,'source_sha256':sh,'processing_fingerprint':fingerprint,'input':{'crs':str(ds.crs),'bounds_lonlat':list(ds.bounds),'shape':[ds.height,ds.width],'pixel_size_degrees':list(ds.res),'approx_pixel_spacing_m_at_center':{'east_west':dx,'north_south':dy},'nodata_tag':ds.nodata,'scale':ds.scales[0],'offset':ds.offsets[0],'AREA_OR_POINT':ds.tags().get('AREA_OR_POINT'),'elevation_units':'m (Copernicus product documentation; vertical reference not encoded in TIFF CRS)','vertical_datum':'EGM2008 per Copernicus DEM product documentation; not verified independently from GeoTIFF'},'streamed_quality':{'finite_pixels':n,'nonfinite_or_masked_pixels':invalid,'exact_zero_pixels_not_interpreted_as_water':zeros,'range_m':[mn,mx],'adjacent_row_differences_gt_100m_flag_count_blockwise':suspicious,'automatic_outlier_correction':False},'analysis':{'projection_epsg':epsg,'center_lonlat':[cx,cy],'core_size_m':[CORE_N*PIX,CORE_N*PIX],'context_size_m':[CTX_N*PIX,CTX_N*PIX],'core_valid_pct':100*float(valid.mean()),'context_valid_pct':100*float(validctx.mean()),'grid_north_offset_deg_as_true_north_seen_in_grid':true_north_grid_az,'landcover_validation':'unverified','note':note,'site_geometry':'tile-center exploratory square only, not verified field-site polygon'},'terrain_stats':ss,'shadow_scenarios':scen}
   reports.append(qa)
   writejson(ROOT/'reports'/f'{name}_quality_and_stats.json',qa)
   with open(ROOT/'reports'/f'{name}_shadow_scenarios.csv','w',newline='') as f:
    wr=csv.DictWriter(f,scen[0].keys());wr.writeheader();wr.writerows(scen)
   # WGS84 polygon exact reprojected core rectangle
   west=coreaff.c; north=coreaff.f;east=west+CORE_N*PIX;south=north-CORE_N*PIX
   transformer=Transformer.from_crs(epsg,4326,always_xy=True)
   border=[(west,north),(east,north),(east,south),(west,south),(west,north)]
   ring=[list(transformer.transform(x,y)) for x,y in border]
   geo.append({'type':'Feature','properties':{'id':name,'landcover_verified':False,'field_training_suitability':'not_assessed','projection_epsg':epsg},'geometry':{'type':'Polygon','coordinates':[ring]}})
   fig,axs=plt.subplots(1,3,figsize=(11,3.5));
   for ax,(label,ar,lo,hi) in zip(axs,[('DSM elevation (m)',core,None,None),('Slope (degrees)',slope[sl],0,40),('Relief (m, 400 m window)',relief[sl],None,None)]):
    im=ax.imshow(ar,cmap='viridis',vmin=lo,vmax=hi);ax.set_title(label,fontsize=9);ax.set_xticks([]);ax.set_yticks([]);fig.colorbar(im,ax=ax,shrink=.8)
   fig.suptitle(f'{name} | 80 m grid, 6.4 km square');fig.tight_layout();png=ROOT/'figures'/f'{name}_terrain.png';fig.savefig(png,dpi=110);plt.close(fig)
   dashshadow=scen[0]
   dashboard.append({'id':name,'label':note,'center_lonlat':[cx,cy],'analysis_epsg':epsg,'spatial_resolution_m':80,'core_size_m':6400,'terrain_stats':ss,'landcover_status':'unverified','field_suitability':'not_assessed','terrain_preview':'../'+pathrel(png),'core_dem':'../'+pathrel(common/f'{name}_core_dem_80m.tif'),'shadow_scenarios_csv':'../'+pathrel(ROOT/'reports'/f'{name}_shadow_scenarios.csv'),'scenarios':scen,'warnings':['Hypothetical sun; not real-time solar position','Unresolved cast-shadow pixels must not be counted as sunlight','DSM includes surfaces; exposed rock not validated']})
   cache.append({'site':name,'key':fingerprint,'source_sha256':sh,'reused':False})
 # invariant tests
 flat=np.zeros((200,200),np.float32)
 tests['flat_shadow_all_clear']=bool(bool(shadow(flat,80,1,0)[40,40]==0))
 obstacle=flat.copy();obstacle[70,100]=100
 shmask=shadow(obstacle,80,1,0);tests['obstacle_blocks_southward_solar_ray']=bool(shmask[31,40]==1)
 gap=flat.copy();gap[65:75,:]=np.nan;tests['gap_unresolved']=bool(np.any(shadow(gap,80,1,0)==2))
 tests['edge_unresolved']=bool(np.any(shadow(flat,80,.5,0,rng=12000)==2))
 # known east-rising plane: slope=atan(0.1), aspect=90
 plane=np.tile(np.arange(200,dtype='float32')*8.,(200,1));dy,dx=np.gradient(plane,80.,80.);tests['known_plane_slope_deg']=bool(abs(np.degrees(np.arctan(np.hypot(dx,dy)))[100,100]-math.degrees(math.atan(.1)))<1e-4)
 tests['known_plane_aspect_east_deg']=bool(abs(((np.degrees(np.arctan2(dx,-dy))+360)%360)[100,100]-90)<1e-4)
 assert all(tests.values()),tests
 writejson(ROOT/'reports'/'automated_tests.json',tests)
 writejson(ROOT/'frontend'/'dashboard_data.json',{'schema_version':'1.0','status':'processed_dem_only; no lunar_or_mars_similarity_scores','sites':dashboard,'shadow_mask_codes':{'0':'clear within tested 6400m ray','1':'cast shadow','2':'unresolved insufficient context'},'sun_scenarios':'hypothetical true-north azimuth, not ephemeris','sun_duration':'not_computed','computed_utc':datetime.now(timezone.utc).isoformat()})
 writejson(ROOT/'frontend'/'sites_wgs84.geojson',{'type':'FeatureCollection','features':geo})
 writejson(ROOT/'metadata'/'settings.json',SETTINGS)
 writejson(ROOT/'metadata'/'source_and_transformations.json',{'inputs':cache,'algorithm_version':VERSION,'source_docs':['https://copernicus-dem-30m.s3.amazonaws.com/readme.html','https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM'],'decisions':['Copernicus DSM is a surface model, not bare-earth validation','80m bilinear reprojection, nearest would be used for class labels if supplied','80m is sample grid, not guarantee of intrinsic accuracy','5x5 local relief is max-min over 400m nominal neighborhood','roughness is local plane-detrended RMS residual with symmetric 5x5 regression; includes no broad regional trend','Cast shadow uses ray traversal and Earth curvature d^2/(2R), not hillshade','Unknown if search exits context before obstruction; 0 means clear only through 6.4km','No filling or smoothing: no automatically detected reason for mutation','UTM used as local metric grid, local scale accuracy not measured; verify distortion before quantitative interplanetary inference','site centers chosen from tile centers; site identity and bare-ground status unverified','no low-sun annual duration or final interplanetary similarity without independent information'],'runtime':{'python':sys.version,'rasterio':rasterio.__version__,'numpy':np.__version__}})
 # reopen and validate outputs
 qa_checks={}
 for site,_,epsg,_ in SITES:
  paths=list((ROOT/'processed').rglob(site+'*.tif'))
  corepaths=[p for p in paths if 'context' not in p.name]
  with rasterio.open(ROOT/'processed/common'/f'{site}_core_dem_80m.tif') as ref:
   for p in corepaths:
    with rasterio.open(p) as d:
     assert d.shape==ref.shape and d.crs==ref.crs and d.transform.almost_equals(ref.transform),p
   qa_checks[site]={'geotiff_reopened':len(paths),'core_geotiffs_grid_aligned':len(corepaths)}
 for item in dashboard:
  for k in ['terrain_preview','core_dem','shadow_scenarios_csv']:
   assert (ROOT/'frontend'/item[k]).resolve().exists(),(item['id'],k)
 assert len(geo)==3
 writejson(ROOT/'reports'/'output_validation.json',qa_checks)
 (ROOT/'README.md').write_text('''# Earth Polar Processed — NASA Space Apps exploratory pipeline\n\nThree Copernicus GLO-30 DSM source GeoTIFFs were read from `Earth.zip` and preserved outside this ZIP, unchanged. `processed/common/` holds 80m DSMs (200×200 context and 80×80 cores), validity masks, and zero-change masks. `terrain/` holds slope (degrees), aspect (clockwise from **grid north**, flats NaN), 5×5 (400m) local elevation range (m) and 5×5 plane-detrended RMS roughness (m). `illumination/` contains 24 casts per site: 0 clear to 6.4km, 1 blocked, 2 unresolved. Core size is 6.4km square, context 16km square.\n\n## Important scientific limits\n- These are tile-centered exploratory regions, **not confirmed field training sites**, bare rock or verified McMurdo/Peary Land polygons. No land-cover dataset was provided, so land cover and training suitability remain **unverified**.\n- Copernicus DEM is a DSM (may contain snow/ice, canopy, buildings); its 80m output spacing does not prove 80m intrinsic accuracy. Sources' pixel sizes vary by latitude. Elevation is in metres; vertical datum must be corroborated from primary product metadata.\n- No NoData filling, smoothing, ocean detection from zeros, or DEM outlier deletion. A count of potential >100m pixel-to-pixel jumps is for inspection only, not a defect verdict. All modified masks contain zero.\n- Aspect is clockwise from grid north. Sun azimuths in CSV are clockwise from true north, converted to grid frame via local projection convergence. Sun angles are hypothetical, not solar ephemerides.\n- Ray search 6400m in steps of 80m; bilinear interpolation, observer at DSM height, Earth curvature correction `d²/(2×6371008.8m)` and no refraction. The beam exits incomplete context => unresolved (2), **never illuminated**. Blocked fraction excludes unresolved pixels from denominator. Context insufficiency and finite search range limit shadow results. Not permanent shadow and not a measured shadow length. Self-shadowing and photometric hillshade are not computed.\n- The sample region, 80m ray step, far-field coverage, vertical datum, ground cover, and UTM distortion need independent validation before scientific claims. No lunar/mars data in this package, hence no similarity rank. No annual low-sun duration model was run; no actual visiting windows inferred.\n- `frontend/dashboard_data.json` paths to pictures and files are relative to `frontend/`. `frontend/sites_wgs84.geojson` is WGS84 core geometry. Backend should serve GeoTIFF/JSON/CSV; frontend may display PNG previews and scenario validity warnings.\n\n## Reproducibility\n`code/run_earth_polar.py` is executed code; `01_Earth_Polar_Cleaning_Preprocessing.ipynb` is an executed, compact notebook entry point. Re-execution requires the three original source TIFFs in `/mnt/data/earth_inputs` unless you edit `INPUT`/`ROOT`. The `metadata/source_and_transformations.json` fingerprint is SHA256(source bytes + stable settings JSON + EPSG); outputs in this run are fresh (fingerprints recorded, no automatic cache skip is implemented). `reports/automated_tests.json` tests known slope/aspect, flat terrain, barrier, unknown gap and edge.\n\nReferences: https://copernicus-dem-30m.s3.amazonaws.com/readme.html and https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM .\n''',encoding='utf8')
 shutil.copy2(__file__,ROOT/'code'/'run_earth_polar.py')
 # file manifest after output created
 rows=[]
 for p in sorted(ROOT.rglob('*')):
  if p.is_file() and p.name!='manifest.csv':rows.append({'path':pathrel(p),'size_bytes':p.stat().st_size,'role':p.parts[-2]})
 with open(ROOT/'manifest.csv','w',newline='') as f:
  w=csv.DictWriter(f,['path','size_bytes','role']);w.writeheader();w.writerows(rows)
 print(json.dumps({'sites':[q['site'] for q in reports],'tests':tests,'outputs':len(rows),'unresolved_fraction_sample':[q['shadow_scenarios'][0]['fraction_of_all_core_pixels_unresolved'] for q in reports]},indent=2))
if __name__=='__main__':main()
