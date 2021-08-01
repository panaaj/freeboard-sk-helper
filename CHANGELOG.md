# CHANGELOG: Freeboard-SK-Helper

### v1.4.0

- **deprecated**: GRIB experiment support.

- **new**: Standard Alarm notification provider (_`notifications.mob`, etc._)

### v1.3.1

- **fix**: Issue where null value would raise arrival alarm notification.

### v1.3.0

- **update**: Remove `./resources/tracks` provider. `signalk-resources-fs v1.3.0` plugin now has the ability to define additional resource paths and `tracks` can be served using this functionality.

### v1.2.5

- **update**: Use `setPluginStatus` and `setPluginError` instead of deprecated `setPoviderStatus` and `setProviderError`

### v1.2.4

- **remove**: `navigation.courseGreatCircle.nextPoint.bearingTrue` calculation (available in `signalk-derived-data` plugin `Course Data`).


### v1.2.3

- **fix**: Issue where after upgrading from previous version putting value `navigation.courseGreatCircle.previousPoint.position` thowing an exception.

### v1.2.2

- **fix**: Issue where persisted `navigation.courseGreatCircle.previousPoint.position` was not part of the delta content on server start up.

### v1.2.1

- **new**: `navigation.courseGreatCircle.previousPoint.position` provider.

### v1.2.0

- **new**: `navigation.courseGreatCircle.nextPoint.arrivalCircle` provider, notifications raised on `navigation.arrivalCircleEntered`.

### v1.1.0

- Port to Typescript.

- **Experiment**: `resources/tracks` provider

### v1.0.0

Initial release.

- **Experiment**: `resources/grib` provider
