**sfpaths** is a pet project that allows quick visualization of a set of Strava paths.

## Flask Server

The `sfpaths.py` script launches a little [Flask](http://flask.pocoo.org/) server that logs in to [Strava](https://www.strava.com/), collects all the Lat-Long data, then generates a consolidated and minimal JSON file called `tracks.json`.

## Javascript App

`index.html / sfpaths.js` is a fast-loading and statically-served web app that uses [D3](https://d3js.org) and talks to the [Google Maps API](https://developers.google.com/maps/documentation/javascript/).

The Javascript app uses flexbox CSS and has two layouts: mobile portrait and mobile landscape / desktop.

Unlike the flask server, the Javascript app does not talk to the Strava API directly.

---

### To be done

- Animate the D3 paths
- Left / Right buttons on mobile.  Remove Header for landscape?
- Add a gh-pages branch
- Blog entry
  - Discuss various overlay approaches with Google Maps
  - Stroke scaling
  - Rebase away the STRAVA_API_SECRET


- Deploy to Google Cloud
- Play button and time slider
  - [Inspiration](https://geoseyeview.wordpress.com/2014/03/08/passion-project-5-d3-gpx-gpx-player/)

```
lonScale = d3.time.scale().domain(dateList).range(lonList).clamp(true);
latScale = d3.time.scale().domain(dateList).range(latList).clamp(true);
```
