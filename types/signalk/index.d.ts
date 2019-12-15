
import { IRouter } from 'express'

export interface ServerPlugin {
    name: string
    description?: string
    id: string,
    version?: string
    start: (config: object, restart: (newConfiguration: object) => void) => any
    stop: () => void
    schema: () => object | object
    uiSchema?: () => object | object
    registerWithRouter?: (router: IRouter) => void
    signalKApiRoutes?: (router: IRouter) => void
    enabledByDefault?: boolean
    statusMessage?: () => string
}

export interface Plugin {
    name: string
    description: string
    id: string
    start: (config: object, restart: (newConfiguration: object) => void) => any
    stop: () => void
    schema: () => object | object
    uiSchema?: () => object | object
    registerWithRouter?: (router: IRouter) => void
    signalKApiRoutes?: (router: IRouter) => void
    enabledByDefault?: boolean
    statusMessage?: () => string
}
  
interface ManagedPlugin extends Plugin {
    version: string
    enableLogging: any
    packageName: any
    packageLocation: string
}
  
export interface ServerAPI extends 
        DeltaManager,
        ProviderStatusLogger,
        ActionManager,
        HistoryManager, StreamBundle {
    getSelfPath: (path: string) => void
    getPath: (path: string) => void
    putSelfPath: (aPath: string, value: any, updateCb: () => void) => Promise<any>
    putPath: (
        aPath: string,
        value: number | string | object | boolean,
        updateCb: (err?: Error) => void
    ) => Promise<any>
    queryRequest: (requestId: string) => Promise<any>
    error: (msg: string) => void
    debug: (msg: string) => void
    handleMessage: (id: string | null, msg: any) => void
    savePluginOptions: (
        configuration: object,
        cb: (err: NodeJS.ErrnoException | null) => void
    ) => void
    readPluginOptions: () => object
    getDataDirPath: () => string
    registerPutHandler: (
        context: string,
        path: string,
        callback: () => void
    ) => void
    config: { configPath:string }
}

interface StreamBundle {
    streambundle: {
        getSelfBus: (path: string) => any    
    }
}

interface DeltaManager {
    registerDeltaInputHandler: (
      handler: (delta: object, next: (delta: object) => void) => void
    ) => void
  }
  
interface ProviderStatusLogger {
    setProviderStatus: (providerId: string, status?: string) => void
    setProviderError: (providerId: string, status?: string) => void
}

interface ProviderManager extends ProviderStatusLogger {
    getProviderStatus: () => [{ id: string; message: string }]
    providerStatus: { [providerId: string]: string }
}
  
interface ActionManager {
    registerActionHandler: (
        context: string,
        path: string,
        id: string,
        callback: (context:string, path:string, value:any, cb?:any) => void
    ) => void
}
  
interface HistoryProvider {
    hasAnydata: (options: object, cb: (hasResults: boolean) => void) => void
    getHistory: (date: Date, path: string, cb: (deltas: object[]) => void) => void
    streamHistory: (
        spark: any,
        options: object,
        onDelta: (delta: object) => void
    ) => void
}
  
interface HistoryManager {
    registerHistoryProvider: (provider: HistoryProvider) => void
    unregisterHistoryProvider: (provider: HistoryProvider) => void
}
