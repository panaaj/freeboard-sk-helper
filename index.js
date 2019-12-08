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

const pkg= require('./package.json')
const PouchDB = require('pouchdb')
const path= require('path')

const grib= require('./lib/gribfiles')

module.exports= function (app) {

    let plugin= {
        id: 'freeboard-sk-helper',
        name: 'Freeboard-SK Helper: (freeboard-sk-helper)',
        description: pkg.description,
        version: pkg.version
    }
    let settings= {}

    let unsubscribe= []     // stream subscriptions
    let timers= []          // interval imers
    let db                  // data store

    let navData= {          // active route data
        activeRoute: {
            href: null,
            startTime: null
        },
        nextPoint: { 
            position: null 
        }        
    }
    
    plugin.start= (props)=> {
        try {
            app.debug(`${plugin.name} starting.......`) 
            app.debug(`** pkgname: ${pkg.name}, pkgversion: ${pkg.version}`) 

            //settings= props || settings
            let basePath= (typeof settings.path==='undefined' )
                ? path.join(app.config.configPath)
                : path.join(settings.path)            
            app.debug('*** Configuration ***')
            app.debug(settings)        

            initDB(basePath)
            .then( res=> {
                app.setProviderStatus(`Started.`) 
                app.debug(`** ${plugin.name} started... ${(res) ? 'OK' : 'with errors!'}`)     
                afterStart()
            })
            .catch( err=> { app.debug(err) } )

            // ** EXPERIMENTS **
            grib.init( path.join(basePath, plugin.id) )
            .then( res=> {
                if(res.error) {app.debug(`*** GRIB ERROR: ${res.message} ***`) }
                app.debug(`*** GRIB provider initialised... ${(!res.error) ? 'OK' : 'with errors!'}`)     
            })
            .catch( e=> { app.debug(`*** GRIB ERROR: ${e} ***`) } )
            // **********                
            
            // **register HTTP PUT handlers
            if(app.registerActionHandler) {
                app.debug('** Registering Action Handler(s) **')    
                app.registerActionHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.activeRoute.href',
                    handlePutCourseData
                )     
                app.registerActionHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.activeRoute.startTime',
                    handlePutCourseData
                )   
                app.registerActionHandler(
                    'vessels.self',
                    'navigation.courseGreatCircle.nextPoint.position',
                    handlePutCourseData
                )                  
            } 

            // ** register STREAM UPDATE message handlers
            app.debug('** Registering STREAM UPDATE Handler(s) **') 
            unsubscribe.push( // ** handle activeRoute.href Update
                app.streambundle.getSelfBus('navigation.courseGreatCircle.activeRoute.href')
                .onValue( v=> {     
                    if(v['$source']==plugin.id) { return }
                    setActiveRoute(v.value)                  
                })
            )
            unsubscribe.push( // ** handle activeRoute.startTime Update
                app.streambundle.getSelfBus('navigation.courseGreatCircle.activeRoute.startTime')
                .onValue( v=> {     
                    if(v['$source']==plugin.id) { return }
                    setActiveRoute(v.value)     
                })
            )   
            unsubscribe.push( 
                app.streambundle.getSelfBus('navigation.courseGreatCircle.nextPoint.position')
                .onValue( v=> {     
                    if(v['$source']==plugin.id) { return }
                    setNextPoint(v.value)    
                })
            ) 
            unsubscribe.push( // ** handle navigation.position. calc bearingTrue
                app.streambundle.getSelfBus('navigation.position')
                .onValue( v=> {     
                    app.debug(`*** ${JSON.stringify(v.value)} ***`)
                    if(navData.nextPoint.position) {
                        val={
                            path: 'navigation.courseGreatCircle.nextPoint.bearingTrue', 
                            value: bearingTo(v.value, navData.nextPoint.position)
                        }   
                        app.debug(`****** Emit course bearingTrue: ******`)
                        app.debug(val)
                        app.handleMessage(plugin.id, {updates: [ {values: [val] } ] })                                                       
                    } 
                })
            )  
        } 
        catch (e) {
            app.setProviderError(`Started with errors!`)
            app.error("error: " + e)
            console.error(e.stack)
            return e
        }       
    }

    plugin.stop= ()=> { 
        app.debug(`${plugin.name} stopping.......`) 
        app.debug('** Un-registering Update Handler(s) **')
        unsubscribe.forEach( b=> b() )
        unsubscribe= []
        app.debug('** Stopping Timer(s) **')
        timers.forEach( t=> clearInterval(t) )
        timers= []     
        if(db) { db.close().then( ()=> app.debug(`** ${db[0]} DB closed **`) ) }
        app.setProviderStatus(`Stopped`)
    }

    plugin.schema= { 
        properties: {
            navData: {
                title: "Course",
                type: "object",
                description: 'Provider for: courseGreatCircle: activeRoute, nextPoint',
            }          
        }
    }

    plugin.uiSchema= { }  

    plugin.signalKApiRoutes= router=> {
        // ** GRIB **
        router.get('/resources/grib/meta', (req, res)=> {
            res.json( {description: 'Collection of JSON fromatted GRIB data.'} )
        })
        router.get('/resources/grib', async (req, res)=> {
            try {
                let r= await grib.getResources('grib', null, {})
                if(typeof r.error!=='undefined') { 
                    res.status(r.status).send(r.message)
                }
                else { res.json(r) }
            }
            catch(err) { res.status(500).send('Error fetching resources!') }            
        })     
        router.get(`/resources/grib/latest`, async (req, res)=> {
            try {
                let r= await grib.getResources('grib', null, {cmd: 'latest'})
                if(typeof r.error!=='undefined') { 
                    res.status(r.status).send(r.message)
                }
                else { res.json(r) }
            }
            catch(err) { res.status(500).send('Error fetching resources!') }            
        })
        router.get(`/resources/grib/*:*`, async (req, res, next)=> {
            try {
                let item= req.path.split('/').slice(-1)[0].split(':')
                let section= (item.length>1) ? item[1].split('-') : null
                app.debug(" **** ", item[0], section)
                let r= await grib.getResources('grib', item[0], {section: section})
                if(typeof r.error!=='undefined') { res.status(r.status).send(r.message) }
                else { res.json(r) } 
            }
            catch(err) { res.status(500).send('Error fetching resources!') }
        })        
        router.get(`/resources/grib/*`, async (req, res)=> {
            try {
                let r= await grib.getResources('grib', req.path.split('/')[3], {})
                if(typeof r.error!=='undefined') { 
                    res.status(r.status).send(r.message)
                }
                else { res.json(r) } 
            }
            catch(err) { res.status(500).send('Error fetching resources!') }            
        })   

        return router
    }

    // *****************************************

    // ** initalise datastore
    initDB= (dbPath)=> {
        return new Promise( (resolve, reject)=> {
            try { 
                db= new PouchDB( path.join(dbPath, `${plugin.id}_db`) )
                resolve({error: false, message: ''})
                db.info().then(r=>{app.debug(r)})
            }
            catch(err) { reject( {error: true, message: err} ) }
        })
    } 

    // ** additional plugin start processing 
    afterStart= async ()=> {
        app.debug('** afterStart() **')
        // ** Get persisted COURSE data and UPDATE cache
        if(db) { 
            let result= await getRecord(db, 'navData')
            if(result.error) { app.debug('** No persisted NavData **') }
            else { navData= result }
        }         
        timers.push( setInterval( emitCourseData, 30000 ) )    
    }

    // ****************************************


    // ** emit delta UPDATE message for persisted COURSE data 
    emitCourseData= ()=> {
        // ** send delta **
        let val= []
        if(typeof navData.activeRoute.href!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.activeRoute.href', 
                value: navData.activeRoute.href
            })
        }
        if(typeof navData.activeRoute.startTime!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.activeRoute.startTime', 
                value: navData.activeRoute.startTime
            })
        }
        if(typeof navData.nextPoint.position!== 'undefined') {
            val.push({
                path: 'navigation.courseGreatCircle.nextPoint.position', 
                value: navData.nextPoint.position
            })                                 
        }       
        if(val.length!=0) {
            app.debug(`****** Emitting COURSE data: ******`)
            app.debug(val)
            app.handleMessage(plugin.id, {updates: [ {values: val} ] })  
        }
    }

    //*** Calculate the bearing between two points in radians ***
    bearingTo= (srcpt, destpt)=> {
        let lat1= degreesToRadians(srcpt.latitude)
        let lat2= degreesToRadians(destpt.latitude)
        let dLon= degreesToRadians(destpt.longitude-srcpt.longitude)
        let y= Math.sin(dLon) * Math.cos(lat2)
        let x= Math.cos(lat1)*Math.sin(lat2) -
                Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon)
        let brad=Math.atan2(y, x)
        let bdeg= radiansToDegrees(brad)
        return (bdeg<0) ? degreesToRadians(360+bdeg) : brad
    }  

    degreesToRadians= (val)=> {  return val * Math.PI/180 }
    radiansToDegrees= (val=0)=> { return val * 180 / Math.PI; }

    //*** Course data processing ***

    handlePutCourseData= (context, path, value, cb)=> {
        app.debug(` 
            ${JSON.stringify(path)}, 
            ${JSON.stringify(value)}`
        )  
        let ok= false
        let val= [ {path: path, value: value} ]

        let p= path.split('.')
        if(p[2]=='activeRoute') {
            if(p[p.length-1]=='href') { 
                ok= setActiveRoute(value, 'href')
                let st= (value) ? navData.activeRoute.startTime : null 
                val.push( {
                    path: 'navigation.courseGreatCircle.activeRoute.startTime', 
                    value: st
                })
            }
            if(p[p.length-1]=='startTime') { ok= setActiveRoute(value, 'startTime') }
        }        
        if(p[2]=='nextPoint') {
            if(p[p.length-1]=='position') { ok= setNextPoint(value) }
        }      
        if(ok) {
            // persist navData values
            if(db) { 
                app.debug('** persisitng navData **', navData)
                updateRecord(db, 'navData', navData)
                .then( r=> {
                    if(r.error) { newRecord(db, 'navData', navData) }
                }) 
            } 
            // ** send delta **
            app.debug(`****** Sending Delta: ******`)
            app.debug(val)
            app.handleMessage(plugin.id, {updates: [ {values: val} ] })   
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

    setActiveRoute= (value, key)=> {
        app.debug('** setActiveRoute **')
        app.debug(key)
        app.debug(value)

        if(key=='href') { 
            navData.activeRoute.href= value 
            let dt= new Date()
            let st= (value) ? dt.toISOString() : null
            navData.activeRoute.startTime= st
        }
        if(key=='startTime') { navData.activeRoute.startTime= value }            
        return true   
    }    

    setNextPoint= (value)=> {
        app.debug('** setNextPoint **')
        app.debug(value)

        if(value) {
            if(typeof value.latitude === 'undefined' || 
                typeof value.longitude === 'undefined') { return false }
        }
        navData.nextPoint.position= value

        return true

    }

    //*** persist / retrieve settings ***

    getRecord= async (db, key)=> {
        try {
            let entry= await db.get(key) 
            return entry.setting
        } 
        catch (err) { 
            app.debug(`Fetch ERROR: ${key} could not be retrieved!`)
            return err
        }
    }

    newRecord= async (db, key, value)=> {
        try {
            let result= await db.put({
                _id: key,
                setting: value
            });
            return result
        } 
        catch (err) { 
            app.debug(`Create ERROR: ${key} could not be created!`)
            return err
        }
    }
    
    updateRecord= async (db, key, value)=> {
        try {
            let entry = await db.get(key);
            let result= await db.put({
                _id: key,
                _rev: entry._rev,
                setting: value
            });
            return result
        } 
        catch (err) { 
            app.debug(`Update ERROR: ${key} was not found... create new resource...`)
            return err
        }
    }    

    return plugin
}
