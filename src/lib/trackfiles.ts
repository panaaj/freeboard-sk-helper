
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import { IResourceStore } from '../index.d';
import { Utils} from './utils';
//import geoJSON from 'geojson-validation';

// ** Track Store Class
export class TrackStore implements IResourceStore {

    savePath: string;
    resources: any;
    pkg: {id:string};
    utils: Utils;

    constructor() {
        this.savePath= '';
        this.resources= {};
        this.pkg= { id: 'freeboard-sk-helper' };
        this.utils= new Utils();
    }

    // ** check / create path to persist resources
    async init(basePath:string) {
        this.savePath= path.join(basePath, `/tracks`);
        this.resources['tracks']= {path: this.savePath};

        let p:any= await this.checkPath(this.savePath);
        if(p.error) { return {error: true, message: `Unable to create ${this.savePath}!`} }
        else { return this.createSavePaths(this.resources) }
    }

    // ** create save paths for resource types
    async createSavePaths(items:any) {
        let result= {error: false, message: ``};
        Object.values(items).forEach( (t:any)=> {
            fs.access( 
                t.path, 
                fs.constants.W_OK | fs.constants.R_OK, 
                err=>{
                    if(err) {
                        console.log(`${t.path} NOT available...`);
                        console.log(`Creating ${t.path} ...`);
                        fs.mkdir(t.path, (err)=> {
                            if(err) { 
                                result.error= true;
                                result.message+= `ERROR creating ${t.path} folder\r\n `;
                            }                           
                        })  
                    }
                    else { console.log(`${t.path} IS Available....`) }
                }
            ) 
        })  
        return result;    
    }    

    //** return persisted tracks from storage
    async getResources(type:string, item:any=null, params:any={}) {
        let result:any= [];
        try {
            if(item) { // return specified track
                let ia= item.split(':');
                item= ia[ia.length-1];
                try {
                    let p= this.resources[type].path;
                    p= path.join(p, `${item}`);
                    let fc= JSON.parse(fs.readFileSync(p, 'utf8'));
                    if(params.section) { // return section
                        if(Array.isArray(params.section)){
                            params.section.forEach( (i:any)=> {
                                let sno= parseInt(i);
                                if(sno< fc.length) { result.push(fc[sno]) }
                            })
                        }
                    }
                    else { result= fc }   
                    return result;                
                }
                catch(err) {
                    console.error('** ERROR **', err);
                    return {
                        message: `Track not found!: ${item}`,
                        status: 404,
                        error: true
                    };	
                }
            }
            else {	// return matching resources
                Object.entries(this.resources).forEach( (rt:any)=> {         
                    if(!type || type==rt[0]) {
                        let files= fs.readdirSync(rt[1].path);
                        files.sort( (a,b)=> { return (a<b) ? 1 : -1});
                        // list track resources
                        result= {};
                        for( let f in files) {
                            let uuid= this.utils.uuidPrefix + files[f];
                            try {
                                let res= JSON.parse(fs.readFileSync( path.join(rt[1].path, files[f]) , 'utf8'));
                                result[uuid]= res;
                                let stats = fs.statSync(path.join(rt[1].path, files[f]));
                                result[uuid]['timestamp'] = stats.mtime;
                                result[uuid]['$source'] = this.pkg.id;
                            }
                            catch(err) {
                                console.log(err);
                                return {
                                    message: `Invalid file contents: ${files[f]}`,
                                    status: 400,
                                    error: true
                                };	
                            }
                        }  
                        
                    }
                })  
                return result;
            }  
            
        }
        catch(err) {
            console.log(err);
            return {
                error: true, 
                message: `Error retreiving resources from ${this.savePath}. Ensure plugin is active or restart plugin!`,
                status: 400
            }
        }
    }

   // ** save / delete (r.value==null) resource file
    async setResource(r:any) {
        let err= {error: true, message: ``, status: 404 }
        if( !this.utils.isUUID(r.id) ) {
            err.message= 'Invalid resource id!';
            return err;
        }
        let fname= r.id.split(':').slice(-1)[0];
        let p= path.join(this.resources[r.type].path, fname);
        //console.log(`******  path: ${p} filename: ${fname} ******`);

        if(r.value===null) { // ** delete file **
            return await (()=> {
                return new Promise( resolve=> {
                    fs.unlink(p, res=> { 
                        if(res) { 
                            console.log('Error deleting resource!');
                            err.message= 'Error deleting resource!';
                            resolve(err);
                        }
                        else { 
                            console.log(`** DELETED: ${r.type} entry ${fname} **`);
                            resolve({ok: true});
                        }
                    });
                });
            })()
        }
        else {  // ** add / update file
            return await (()=> {
                return new Promise( resolve=> {
                    if( !this.validateTrack(r.value) ) { // ** invalid track value **
                        err.message= 'Invalid Track data!';
                        resolve(err);
                    }
                    // ** valid Track value **
                    fs.writeFile(p, JSON.stringify(r.value), (error)=> {
                        if(error) { 
                            console.log('Error updating Track!');
                            err.message= 'Error updating Track!';
                            resolve(err);
                        }
                        else { 
                            console.log(`** ${r.type} written to ${fname} **`); 
                            resolve({ok: true});
                        }
                    });
                });
            })()
        }      
    }     

    // ** check path exists / create it if it doesn't **
    checkPath(path:string= this.savePath):Promise<any> {
        return new Promise( (resolve, reject)=> {
            if(!path) { resolve({error: true, message: `Path not supplied!`}) }
            fs.access( // check path exists
                path, 
                fs.constants.W_OK | fs.constants.R_OK, 
                err=> {
                    if(err) {  //if not then create it
                        console.log(`${path} does NOT exist...`);
                        console.log(`Creating ${path} ...`);
                        mkdirp(path, (err:any)=> {
                            if(err) { resolve({error: true, message: `Unable to create ${path}!`}) }
                            else { resolve({error: false, message: `Created ${path} - OK...`}) }
                        })
                    }
                    else { // path exists
                        console.log(`${path} - OK...`);
                        resolve({error: false, message: `${path} - OK...`});
                    }
                }
            )
        })
    }

    // ** validate track data
    validateTrack(trk:any):boolean {
		try {
			if(!trk.feature ) { //|| !geoJSON.valid(trk.feature)) { 
				return false;
			}
		}
		catch(e) { console.log(e); return false }
        return true;
    }

}
