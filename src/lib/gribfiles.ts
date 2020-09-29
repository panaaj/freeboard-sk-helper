
import fs from 'fs';
import path from 'path';
import mkdirp from 'mkdirp';
import { IResourceStore } from '../types/';

// ** GRIB Store Class
export class GribStore implements IResourceStore {

    savePath: string;
    resources: any;

    constructor() {
        this.savePath= '';
        this.resources= {};
    }

    // ** check / create path to persist resources
    async init(basePath:string) {
        this.savePath= path.join(basePath, `/grib`);
        this.resources['grib']= {path: this.savePath};

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

    //** return persisted resources from storage
    async getResources(type:string, item:any=null, params:any={}) {
        let result:any= [];
        try {
            if(item) { // return specified resource
                try {
                    let p= this.resources[type].path;
                    p= path.join(p, `${item}.json`);
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
                        message: `Resource not found!: ${item}`,
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
                        // process params
                        if(params.cmd && params.cmd=='latest') { // return latest GRIB data
                            try {
                                result= JSON.parse(fs.readFileSync( path.join(rt[1].path, files[0]), 'utf8'));
                            }
                            catch(err) {
                                console.error('** ERROR **', err);
                                return {
                                    message: `Invalid file contents: ${files[0]}`,
                                    status: 400,
                                    error: true
                                };                       
                            }
                        }
                        else {  // list GRIB resources
                            result= {};
                            for( let f in files) {
                                let tf:any= files[f].slice(0,10);
                                let res:any= { contents: [] };
                                let fc:any;
                                try {
                                    fc= JSON.parse(fs.readFileSync( path.join(rt[1].path, files[f]), 'utf8'))
                                    fc.forEach( (i:any)=> {
                                        let h:any= {};
                                        h['parameterCategory']= i.header['parameterCategory'];
                                        h['parameterCategoryName']= i.header['parameterCategoryName'];
                                        h['parameterNumber']= i.header['parameterNumber'];
                                        h['parameterNumberName']= i.header['parameterNumberName'];
                                        h['genProcessTypeName']= i.header['genProcessTypeName'];
                                        h['disciplineName']= i.header['disciplineName'];
                                        h['gridDefinitionTemplate']= i.header['gridDefinitionTemplate'];
                                        h['gridDefinitionTemplateName']= i.header['gridDefinitionTemplateName'];
                                        h['gribEdition']= i.header['gribEdition'];
                                        h['refTime']= i.header['refTime'];
                                        res.contents.push(h);
                                    })
                                }
                                catch(err) {
                                    console.error('** ERROR **', err);
                                    console.log(err);
                                    console.log(`Invalid file contents: ${files[f]}`);
                                }                        
                                result[tf]= res;
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

}
