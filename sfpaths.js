'use strict';

let activities = {};
let activityIds = [];
let selectedId = 0;
let centralMap = null;
let mapOverlay = null;
let minLatLong = [1000, 1000];
let maxLatLong = [-1000, -1000];
let pathShape = d3.line();

function Activity(id, date, trackArray) {
    this.id = id;
    this.date = date;  // ISO 8601 string
    this.timepoints = []; // list of integer seconds since start of activity
    this.latitudes = [];
    this.longitudes = [];
    this.lines = [];
    for (let i = 0; i < trackArray.length; i += 3) {
      const lat = trackArray[i];
      const long = trackArray[i + 1];
      const timepoint = trackArray[i + 2];
      minLatLong[0] = Math.min(minLatLong[0], lat);
      maxLatLong[0] = Math.max(maxLatLong[0], lat);
      minLatLong[1] = Math.min(minLatLong[1], long);
      maxLatLong[1] = Math.max(maxLatLong[1], long);
      this.timepoints.push(timepoint);
      this.latitudes.push(lat);
      this.longitudes.push(long);
      this.lines.push([lat, long]);
    }
    this.d3data = {};
    Object.freeze(this);
    return this;
}

function getAnchorClass(id)  {
  const klass = "nav-link ";
  if (id == selectedId) {
    return klass + "active";
  }
  return klass;
}

function updateStravaLink(id) {
  d3.select('#strava-link')
    .text('Strava Activity ' + id)
    .attr("href", "https://www.strava.com/activities/" + id);
}

function updateSvgPath(id) {
  d3.select("svg path")
    .datum(activities[id].lines)
    .attr("d", pathShape);
};

function initMap() {
  const bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(minLatLong[0], minLatLong[1]),
    new google.maps.LatLng(maxLatLong[0], maxLatLong[1]));
  let originalHeight = 1;

  centralMap.fitBounds(bounds);
  d3.select("#map").style('display', 'block');
  mapOverlay = new google.maps.OverlayView();

  mapOverlay.onAdd = function() {
    const proj = this.getProjection();
    const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
    const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
    const span = bounds.toSpan();
    const aabb = bounds.toJSON();
    const width = ne.x - sw.x;
    const height = sw.y - ne.y;
    const scalex = width / span.lng();
    const scaley = height / span.lat();

    pathShape
      .x(d => (d[1] - aabb.west) * scalex)
      .y(d => height - (d[0] - aabb.south) * scaley);

    d3.select(this.getPanes().overlayLayer)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", "0 0 " + width + " " + height)
      .append("path")
      .attr("fill", "none")
      .attr("stroke", "rgb(255,45,38)")
      .attr("stroke-width", 1);

    updateSvgPath(selectedId);
    originalHeight = height;
  };

  mapOverlay.draw = function() {
    const proj = this.getProjection();
    const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
    const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
    const width = ne.x - sw.x;
    const height = sw.y - ne.y;
    d3.select(this.getPanes().overlayLayer)
      .style("left", sw.x + "px")
      .style("top", ne.y + "px")
      .style("width", width + "px")
      .style("height", height + "px")
      .select("path")
      .attr("stroke-width", originalHeight / height);
  };

  mapOverlay.setMap(centralMap);
}

function googleMapsReady() {
  centralMap = new google.maps.Map(d3.select("#map").node(), {
    mapTypeId: google.maps.MapTypeId.TERRAIN,
    fullscreenControl: false,
    streetViewControl: false,
    mapTypeControl: false,
    keyboardShortcuts: false,
  });
  if (selectedId) {
    initMap();
  }
}

d3.json("tracks.json", (error, activityData) => {
  if (error) throw error;
  for (const id in activityData) {
    const item = activityData[id];
    activities[id] = new Activity(id, item['date'], item['track']);
  };

  // The most recent activity should come first.
  activityIds = Object.keys(activities);
  activityIds.sort((a, b) => { return b - a; });
  selectedId = activityIds[0];

  d3.select(".nav")
    .selectAll("li")
    .data(activityIds)
    .enter()
    .append("li")
    .append("a")
    .attr("class", getAnchorClass)
    .attr("href", "#")
    .text(id => {
      const date = new Date(activities[id].date);
      return date.toDateString();
    })
    .on("click", (id, index) => selectActivity(index));

  updateStravaLink(selectedId);
  if (centralMap) {
    initMap();
  }
});

function selectActivity(index) {
  if (index < 0 || index >= activityIds.length) {
    return;
  }
  selectedId = activityIds[index];
  d3.selectAll(".nav a").attr("class", getAnchorClass);
  updateStravaLink(selectedId);
  updateSvgPath(selectedId);
}

d3.select("body").on("keydown", () => {
  const key = d3.event.which;
  const liNode = d3.select(".active").node().parentElement;
  const ulNode = liNode.parentElement;
  const index = Array.prototype.indexOf.call(ulNode.childNodes, liNode) - 1;
  if (key == 39 || key == 40) {
    selectActivity(index + 1);
  } else if (key == 37 || key == 38) {
    selectActivity(index - 1);
  }
});
