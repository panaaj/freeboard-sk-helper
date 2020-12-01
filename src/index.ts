/*
* Copyright 2018 Adrian Panazzolo <panaaj@hotmail.com>
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import { ServerPlugin, ServerAPI, ActionResult, 
        ALARM_METHOD, ALARM_STATE, 
        DeltaMessage, DeltaUpdate } from '@panaaj/sk-types';
import PouchDB from 'pouchdb';
import path from 'path';
import fs from 'fs';
import mkdirp from 'mkdirp';
import { GribStore } from './lib/gribfiles';
import { Watcher, Notifier, Notification } from './lib/alarms';


const CONFIG_SCHEMA= {
    properties: {
        navData: {
            title: "Course",
            type: "object",
            description: 'Provider for: courseGreatCircle: activeRoute, nextPoint, previousPoint',
        }
    }
}

const CONFIG_UISCHEMA= {}

// ** active navigation.courseGreatCircle data **
interface NavData {          
    activeRoute: {
        href: string | null;
        startTime: string | null;
    };
    nextPoint: { 
        position: any;
        arrivalCircle: number | null;
    };
    previousPoint: { 
        position: any;
    }        
}

module.exports = (server: ServerAPI): ServerPlugin=> {
    let watcher: Watcher= new Watcher();     // watch distance from arrivalCircle 
    let notifier: Notifier= new Notifier();  // sends notifications
    let settings= { path:'' };     // ** applied configuration settings          
    let subscriptions: Array<any>= []; // stream subscriptions   
    let timers: Array<any>= [];        // interval imers
    let db:any;                   // data store   
    let navData: NavData= {          
        activeRoute: {
            href: null,
            startTime: null
        },
        nextPoint: { 
            position: null,
            arrivalCircle: null
        },
        previousPoint: { 
            position: null
        }     
    };          
    let grib: GribStore= new GribStore();
   
    // ******** REQUIRED PLUGIN DEFINITION *******
    let plugin: ServerPlugin= {
        id: 'freeboard-sk-helper',
        name: 'Freeboard-SK Helper: (freeboard-sk-helper)',
        schema: ()=> (CONFIG_SCHEMA),
        uiSchema: ()=> (CONFIG_UISCHEMA),   
        start: (options:any, restart:any)=> { doStartup( options, restart ) },
        stop: ()=> { doShutdown() },
        signalKApiRoutes: (router:any)=> { return initSKRoutes(router) }
    }
    // ************************************
    const doStartup= (options:any, restart:any)=> { 
        settings= options;
        let status:string= ''
        try {
            server.debug("** starting up **");
            let basePath= (typeof settings.path==='undefined' )
                ? path.join(server.config.configPath, plugin.id)
                : path.join(settings.path, plugin.id);
            server.debug('*** Configuration ***');
            server.debug(JSON.stringify(settings));       

            initDB(basePath)
            .then( (res:any)=> {
                status=`Started.`;
                if(typeof server.setPluginStatus === 'function') { server.setPluginStatus(status) }
                else { server.setProviderStatus(status) }
                server.debug(`** ${plugin.name} started... ${(res) ? 'OK' : 'with errors!'}`);    
                afterStart();
            })
            .catch( (err:any)=> { server.debug(err) } );

            // ** EXPERIMENTS **
            grib.init(basePath)
            .then( res=> {
                if(res.error) { server.debug(`*** GRIB ERROR: ${res.message} ***`) }
                else { status+= ' EXP:resources/grib' }
                if(typeof server.setPluginStatus === 'function') { server.setPluginStatus(status) }
                else { server.setProviderStatus(status) }
                server.debug(`*** GRIB provider initialised... ${(!res.error) ? 'OK' : 'with errors!'}`);
            })
            .catch( (err:any)=> { server.debug(`*** GRIB ERROR: ${err} ***`) } );        
            // **********                
            
            // **register HTTP PUT handlers
            if(server.registerPutHandler) {
                server.debug('** Registering Action Handler(s) **')    
                server.registerPutHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.activeRoute.href',
                    handlePutCourseData
                ); 
                server.registerPutHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.activeRoute.startTime',
                    handlePutCourseData
                ); 
                server.registerPutHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.nextPoint.position',
                    handlePutCourseData
                );
                server.registerPutHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.nextPoint.arrivalCircle',
                    handlePutCourseData
                );
                server.registerPutHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.previousPoint.position',
                    handlePutCourseData
                );                               
            } 

            // ** register STREAM UPDATE message handlers
            server.debug('** Registering STREAM UPDATE Handler(s) **'); 
            subscriptions.push( // ** handle activeRoute.href Update
                server.streambundle.getSelfBus('navigation.courseGreatCircle.activeRoute.href')
                .onValue( (v:any)=> {     
                    if(v['$source']==plugin.id) { return }
                    setActiveRoute(v.value)                 
                })
            );
            subscriptions.push( // ** handle activeRoute.startTime Update
                server.streambundle.getSelfBus('navigation.courseGreatCircle.activeRoute.startTime')
                .onValue( (v:any)=> {     
                    if(v['$source']==plugin.id) { return }
                    setActiveRoute(v.value)   
                })
            );
            subscriptions.push( 
                server.streambundle.getSelfBus('navigation.courseGreatCircle.nextPoint.position')
                .onValue( (v:any)=> {     
                    if(v['$source']==plugin.id) { return }
                    setNextPoint(v.value);   
                })
            );
            subscriptions.push( 
                server.streambundle.getSelfBus('navigation.courseGreatCircle.previousPoint.position')
                .onValue( (v:any)=> {     
                    if(v['$source']==plugin.id) { return }
                    setPreviousPoint(v.value);   
                })
            );            
            subscriptions.push( // ** handle nextPoint.arrivalCircle Update
                server.streambundle.getSelfBus('navigation.courseGreatCircle.nextPoint.arrivalCircle')
                .onValue( (v:any)=> {     
                    if(v['$source']==plugin.id) { return }
                    setArrivalCircle(v.value)   
                })
            );  
            subscriptions.push( // ** monitor nextPoint.distance updates
                server.streambundle.getSelfBus('navigation.courseGreatCircle.nextPoint.distance')
                .onValue( (v:any)=> {     
                    if(navData.nextPoint.arrivalCircle) {
                        watcher.value= v.value;
                    }
                })
            );    
            let msg:string= 'Started';       
            if(typeof server.setPluginStatus === 'function') { server.setPluginStatus(msg) }
            else { server.setProviderStatus(msg) }
        } 
        catch(err) {
            let msg:string= 'Started with errors!';       
            if(typeof server.setPluginError === 'function') { server.setPluginError(msg) }
            else { server.setProviderError(msg) }
            server.error('** EXCEPTION: **');
            server.error(err.stack);
            return err;
        }          
    }  

    const doShutdown= ()=> { 
        server.debug("** shutting down **");
        server.debug('** Un-registering Update Handler(s) **');
        subscriptions.forEach( b=> b() );
        subscriptions= [];
        server.debug('** Stopping Timer(s) **');
        timers.forEach( t=> clearInterval(t) );
        timers= [];
        notifier.stop();
        if(db) { db.close().then( ()=> server.debug(`** ${db[0]} DB closed **`) ) }       
        let msg:string= 'Stopped';       
        if(typeof server.setPluginStatus === 'function') { server.setPluginStatus(msg) }
        else { server.setProviderStatus(msg) }
    }

    const initSKRoutes= (router:any) => {
        server.debug(`** Registering HTTP paths **`);
        // ** GRIB **
        router.get('/resources/grib/meta', (req:any, res:any)=> {
            res.json( {description: 'Collection of JSON fromatted GRIB data.'} );
        })
        router.get('/resources/grib', async (req:any, res:any)=> {
            try {
                let r= await grib.getResources('grib', null, {});
                if(typeof r.error!=='undefined') { 
                    res.status(r.status).send(r.message);
                }
                else { res.json(r) }
            }
            catch(err) { res.status(500).send('Error fetching resources!') }            
        });
        router.get(`/resources/grib/latest`, async (req:any, res:any)=> {
            try {
                let r= await grib.getResources('grib', null, {cmd: 'latest'});
                if(typeof r.error!=='undefined') { 
                    res.status(r.status).send(r.message);
                }
                else { res.json(r) }
            }
            catch(err) { res.status(500).send('Error fetching resources!') }            
        });
        router.get(`/resources/grib/*:*`, async (req:any, res:any, next:any)=> {
            try {
                let item= req.path.split('/').slice(-1)[0].split(':');
                let section= (item.length>1) ? item[1].split('-') : null;
                let r= await grib.getResources('grib', item[0], {section: section});
                if(typeof r.error!=='undefined') { res.status(r.status).send(r.message) }
                else { res.json(r) } 
            }
            catch(err) { res.status(500).send('Error fetching resources!') }
        });
        router.get(`/resources/grib/*`, async (req:any, res:any)=> {
            try {
                let r= await grib.getResources('grib', req.path.split('/')[3], {});
                if(typeof r.error!=='undefined') { 
                    res.status(r.status).send(r.message);
                }
                else { res.json(r) } 
            }
            catch(err) { res.status(500).send('Error fetching resources!') }            
        });

        return router;
    }

    // *****************************************

    // ** initalise datastore
    const initDB= (dbPath:string)=> {
        return new Promise( (resolve, reject)=> {
            try {      
                checkPath(dbPath).then( function(p:any) {
                    if(p.error) { 
                        resolve( {error: true, message: `Unable to create path ${dbPath}!`} );
                    }
                    else {            
                        db= new PouchDB( path.join(dbPath, `course_db`) );
                        resolve({error: false, message: ''});
                        db.info().then( (r:any)=> { server.debug(r) } );
                    }
                });
            }
            catch(err) { reject( {error: true, message: err} ) }
        });
    } 

    // ** check path exists / create it if it doesn't **
    const checkPath= (path:string)=> {
        server.debug('*** DBinit - checkPath');
        return new Promise( (resolve, reject)=> {
            if(!path) { resolve({error: true, message: `Path not supplied!`}) }
            fs.access( // check path exists
                path, 
                fs.constants.W_OK | fs.constants.R_OK, 
                (err:any)=> {
                    if(err) {  //if not then create it
                        server.debug(`DBInit ${path} does NOT exist...`);
                        server.debug(`DBInit creating ${path} ...`);
                        mkdirp(path, (err:any)=> {
                            if(err) { 
                                server.debug(`DBInit unable to create  ${path} ...\n${err}`);
                                resolve({error: true, message: `Unable to create ${path}!`});
                            }
                            else { 
                                server.debug(`DBInit created ${path} - OK...`);
                                resolve({error: false, message: `Created ${path} - OK...`});                             
                            }
                        })
                    }
                    else { // path exists
                        server.debug(`DBInit ${path} - OK...`);
                        resolve({error: false, message: `${path} - OK...`});
                    }
                }
            )
        })
    }    

    // ** additional plugin start processing 
    const afterStart= async ()=> {
        // ** Get persisted COURSE data and UPDATE cache
        if(db) { 
            let result= await getRecord(db, 'navData');
            if(result.error) { console.log('** No persisted NavData **') }
            else { 
                if(!result.previousPoint) { result.previousPoint= null }
                navData= result;
                watcher.rangeMax= result.nextPoint.arrivalCircle;
                emitCourseData();
            }
        }         
        timers.push( setInterval( emitCourseData, 30000 ) );
    }
    
    // ********* Arrival circle events *****************

    watcher.onInRange= (val:number)=> {
        notifier.notification= new Notification(
            'arrivalCircleEntered',
            `Approaching Destination: ${val}m`,
            ALARM_STATE.warn, 
            [ALARM_METHOD.sound, ALARM_METHOD.visual]
        );    
    }  

    watcher.onEnterRange= (val:number)=> {
        emitNotification( 
            new Notification(
                'arrivalCircleEntered',
                `Approaching Destination: ${val}m`,
                ALARM_STATE.warn, 
                [ALARM_METHOD.sound, ALARM_METHOD.visual]
            )
        ); 
        notifier.start();         
    }

    watcher.onExitRange= (val:number)=> {
        emitNotification( 
            new Notification(
                'arrivalCircleEntered',
                `${val} > (${navData.nextPoint.arrivalCircle})`,
                ALARM_STATE.normal, 
                []
            )
        );
        notifier.stop();      
    }    

    // ** send notification delta message **
    const emitNotification= (n:Notification | DeltaMessage)=> {
        let msg:DeltaMessage= (n instanceof Notification) ? n.message : n;
        let delta:DeltaUpdate= {
            updates: [{ values: [msg] }]
        }
        server.handleMessage(plugin.id, delta);
    }      

    // ****************************************


    // ** emit delta UPDATE message for persisted COURSE data 
    const emitCourseData= ()=> {
        // ** send delta **
        let val: Array<DeltaMessage>= [];
        if(typeof navData.activeRoute.href!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.activeRoute.href', 
                value: navData.activeRoute.href
            });
        }
        if(typeof navData.activeRoute.startTime!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.activeRoute.startTime', 
                value: navData.activeRoute.startTime
            });
        }
        if(typeof navData.nextPoint.position!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.nextPoint.position', 
                value: navData.nextPoint.position
            });                                
        }
        if(typeof navData.nextPoint.arrivalCircle!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.nextPoint.arrivalCircle', 
                value: navData.nextPoint.arrivalCircle
            });                                
        }     
        if(navData.previousPoint && typeof navData.previousPoint.position!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.previousPoint.position', 
                value: navData.previousPoint.position
            });                                
        }  
        if(val.length!=0) {
            server.debug(`****** Emitting COURSE data: ******`);
            server.debug(JSON.stringify(val));
            let msg: DeltaUpdate= {updates: [ {values: val} ] }
            server.handleMessage(plugin.id, msg); 
        }
      
    }

    //*** Course data processing ***

    const handlePutCourseData= (context:string, path:string, value:any, cb:any):ActionResult => {
        server.debug(` 
            ${JSON.stringify(path)}, 
            ${JSON.stringify(value)}`
        ); 
        let ok= false;
        let val= [ {path: path, value: value} ];

        let p= path.split('.');
        if(p[2]=='activeRoute') {
            if(p[p.length-1]=='href') { 
                ok= setActiveRoute(value, 'href');
                let st= (value) ? navData.activeRoute.startTime : null;
                val.push( {
                    path: 'navigation.courseGreatCircle.activeRoute.startTime', 
                    value: st
                });
            }
            if(p[p.length-1]=='startTime') { ok= setActiveRoute(value, 'startTime') }
        }        
        if(p[2]=='nextPoint') {
            if(p[p.length-1]=='position') { ok= setNextPoint(value) }
            if(p[p.length-1]=='arrivalCircle') { ok= setArrivalCircle(value) }
        }
        if(p[2]=='previousPoint') {
            if(p[p.length-1]=='position') { ok= setPreviousPoint(value) }
        }          

        if(ok) {
            // persist navData values
            if(db) { 
                server.debug(`** persisitng navData **\n${navData}`);
                updateRecord(db, 'navData', navData)
                .then( (r:any)=> {
                    if(r.error) { newRecord(db, 'navData', navData) }
                });
            } 
            // ** send delta **
            server.debug(`****** Sending Delta: ******`);
            server.debug(JSON.stringify(val));
            server.handleMessage(plugin.id, {updates: [ {values: val} ] });
            return { state: 'COMPLETED', resultStatus: 200, statusCode: 200 } 
        }  
        else {
            return { 
                state: 'COMPLETED', 
                resultStatus: 400, 
                statusCode: 400,
                message: `Invalid reference!` 
            }              
        } 
    }

    const setActiveRoute= (value:any, key?:string)=> {
        console.log('** setActiveRoute **', key ? key : 'no key');
        if(key=='href') { 
            navData.activeRoute.href= value;
            let dt= new Date();
            let st:any= (value) ? dt.toISOString() : null;
            navData.activeRoute.startTime= st;
        }
        if(key=='startTime') { navData.activeRoute.startTime= value }            
        return true; 
    }    

    const setNextPoint= (value:any)=> {
        console.log('** setNextPoint **', value)
        if(value) {
            if(typeof value.latitude === 'undefined' || 
                typeof value.longitude === 'undefined') { return false }
        }
        navData.nextPoint.position= value;
        return true;
    }

    const setPreviousPoint= (value:any)=> {
        console.log('** setPreviousPoint **', value)
        if(value) {
            if(typeof value.latitude === 'undefined' || 
                typeof value.longitude === 'undefined') { return false }
        }
        if(!navData.previousPoint) {
            navData.previousPoint= {position: value};
        }
        else { navData.previousPoint.position= value }
        return true;
    }    

    const setArrivalCircle= (value:any)=> {
        console.log('** setArrivalCircle **', value);
        if(value!== null && typeof value !=='number') { return false }
        navData.nextPoint.arrivalCircle= value;
        watcher.rangeMax= value;
        return true;
    }

    //*** persist / retrieve settings ***

    const getRecord= async (db:any, key:any)=> {
        try {
            let entry= await db.get(key);
            return entry.setting;
        } 
        catch (err) { 
            server.debug(`Fetch ERROR: ${key} could not be retrieved!`)
            return err;
        }
    }

    const newRecord= async (db:any, key:any, value:any)=> {
        try {
            let result= await db.put({
                _id: key,
                setting: value
            });
            return result;
        } 
        catch (err) { 
            server.debug(`Create ERROR: ${key} could not be created!`);
            return err;
        }
    }
    
    const updateRecord= async (db:any, key:any, value:any)=> {
        try {
            let entry = await db.get(key);
            let result= await db.put({
                _id: key,
                _rev: entry._rev,
                setting: value
            });
            return result;
        } 
        catch (err) { 
            server.debug(`Update ERROR: ${key} was not found... create new resource...`);
            return err;
        }
    }

    // ******************************************
    return plugin;
}
