// ** utility library functions **

export class Utils {
	
	uuidPrefix:string= 'urn:mrn:signalk:uuid:';
	
    // ** returns true if id is a valid UUID **
    isUUID(id:string) {
        let uuid= RegExp("^urn:mrn:signalk:uuid:[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-4[0-9A-Fa-f]{3}-[89ABab][0-9A-Fa-f]{3}-[0-9A-Fa-f]{12}$");
        return uuid.test(id);
    }

}
