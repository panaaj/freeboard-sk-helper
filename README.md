# Freeboard-SK-Helper:

**Signal K Server** helper plugin for **Freeboard-SK** that 
acts as an API provider for the Signal K paths that are required to support Freeboard-SK operation and which may not be serviced by a Signal K server or installed plugins:

---
_Note: this plugin may be used from time to time to provide functionality for experimental features that may become part of Feeboard-SK in the future._

---

### Serviced Signal K Paths:

#### Course Data:

Provider to support the setting of an `Active Route` or Waypoint / Location as the current `Destination`.

_Used in conjunction with the `Derived Data` plugin this enables the display of data related to the current destination._


_HTTP: (GET/PUT)_
```
./vesels/self/navigation/courseGreatCircle/activeRoute/href

./vesels/self/navigation/courseGreatCircle/activeRoute/startTime

./vesels/self/navigation/courseGreatCircle/nextPoint/position

./vesels/self/navigation/courseGreatCircle/nextPoint/arrivalCircle
```

_Stream:_
```
vessels.self.navigation.courseGreatCircle.activeRoute.href

vessels.self.navigation.courseGreatCircle.activeRoute.startTime

vessels.self.navigation.courseGreatCircle.nextPoint.position

vessels.self.navigation.courseGreatCircle.nextPoint.arrivalCircle
```

_Deltas: (sent for the following paths)_
```
navigation.courseGreatCircle.activeRoute.href

navigation.courseGreatCircle.activeRoute.startTime

navigation.courseGreatCircle.nextPoint.position

navigation.courseGreatCircle.nextPoint.arrivalCircle
```

Notifications: (sent for the following paths)_
```
navigation.arrivalCircleEntered
```

---
### Experiments:

#### Arrival Alarm:

Serves as a provider for the path `navigation.courseGreatCircle.nextPoint.arrivalCircle` to enable the radius of the circle surrounding the active destination to be defined.

This radius is then used to send a notification using the path `navigation.arrivalCircleEntered` to notify that the vessel has entered the arrival circle.


#### GRIB2JSON file provision:

Serves the content of JSON formatted GRIB data produced by the GRIB2JSON tool at the path `./resources/grib`.

To make the GRIB JSON file available place the json file in the `/home/<user>/.signalk/freeboard-sk-helper/grib` folder of your Signal K server.

GRIB JSON data can be viewed in the following ways using the HTTP API:
1) List summary of available GRIB data: `./resources/grib`
1) List contents of the most current GRIB file: `./resources/grib/latest`
1) List contents of a GRIB file: `./resources/grib/id` where `id` is the id of the GRIB file returned in 1).
1) List only the specific sections of a GRIB file: `./resources/grib/id:n` where `id` is the id of the GRIB file and `n` is the index of the section in the file.

_Example: get contents of GRIB file 2019101200_
`./resources/grib/2019101200`

_Example: get first section of GRIB file 2019101200_
`./resources/grib/2019101200:0`

_Example: get first and third section of GRIB file 2019101200_
`./resources/grib/2019101200:0-2`


#### Tracks provider:

Serves GeoJSON "MultiLineString" features to the path `./resources/tracks`in order to make imported Track data available from your Signal K server.

`Freeboard-SK` v1.11.0 or greater with `Experiments` enabled will allow GPX Track data to be uploaded a the Signal K server with this plugin installed.
