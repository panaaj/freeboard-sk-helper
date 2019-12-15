import fs from 'fs';
import mkdirp from 'mkdirp';

// ** Abstract Base Resource Store Class
export class ResourceStoreBase {
    savePath: string;
    resources: any;

    constructor() {
        this.savePath= ''
        this.resources= {}
    }

    async init(basePath:string):Promise<any> {}
    close() {}
    async getResources(type:string, item:any, params:any):Promise<any> {}
    async setResource(r:any):Promise<any> {}

    // ** check path exisits / create it if it doesn't **
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
