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


#### Arrival Alarm:

Serves as a provider for the path `navigation.courseGreatCircle.nextPoint.arrivalCircle` to enable the radius of the circle surrounding the active destination to be defined.

This radius is then used to send a notification using the path `navigation.arrivalCircleEntered` to notify that the vessel has entered the arrival circle.

_Notifications: (sent for the following paths)_
```
navigation.arrivalCircleEntered
```

---
### Experiments:

- N/A


