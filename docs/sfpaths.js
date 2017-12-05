'use strict';

let activities = {};
let activityIds = [];
let selectedId = 0;
let centralMap = null;
let mapOverlay = null;
let minLatLong = [1000, 1000];
let maxLatLong = [-1000, -1000];
let pathShape = d3.line();

function Activity(id, trackObject) {
  this.id = id;
  this.date = trackObject['date'];  // ISO 8601 string
  this.duration = secondsToString(trackObject['duration']);
  this.max_mph = 2.23694 * trackObject['max_speed'];
  this.avg_mph = 2.23694 * trackObject['average_speed'];
  this.timepoints = []; // list of integer seconds since start of activity
  this.latitudes = [];
  this.longitudes = [];
  this.lines = [];
  const tracks = trackObject['track'];
  for (let i = 0; i < tracks.length; i += 3) {
    const lat = tracks[i];
    const long = tracks[i + 1];
    const timepoint = tracks[i + 2];
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

function updateHeader(id) {
  d3.select('#strava-link')
    .text('Strava ' + id)
    .attr("href", "https://www.strava.com/activities/" + id);
  const activity = activities[id];
  d3.select('#info').text(
    activity.avg_mph.toFixed(1) + ' / ' +
    activity.max_mph.toFixed(1) + ' mph');
}

function updateSvgPath(activityId) {
  let selection = d3.select("svg path")
    .datum(activities[activityId].lines);

  // If this is the first time drawing the path, no need to animate.
  if (!d3.select("svg path").attr("d")) {
    selection.attr("d", pathShape);
    return;
  }

  selection.transition().attrTween('d', function(data) {
      var previous = d3.select(this).attr('d');
      var current = pathShape(data);
      return interpolatePath(previous, current);
    });
};

function initMap() {
  const bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(minLatLong[0], minLatLong[1]),
    new google.maps.LatLng(maxLatLong[0], maxLatLong[1]));
  let originalHeight;

  centralMap.fitBounds(bounds);
  mapOverlay = new google.maps.OverlayView();

  mapOverlay.onAdd = function() {
    const proj = this.getProjection();
    const ne = proj.fromLatLngToDivPixel(bounds.getNorthEast());
    const sw = proj.fromLatLngToDivPixel(bounds.getSouthWest());
    const span = bounds.toSpan(), aabb = bounds.toJSON();
    const width = ne.x - sw.x, height = sw.y - ne.y;
    const scalex = width / span.lng(), scaley = height / span.lat();

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
      .attr("stroke", "#2d699e");

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

function selectActivity(index) {
  if (index < 0 || index >= activityIds.length) {
    return;
  }
  selectedId = activityIds[index];
  d3.selectAll(".nav a").attr("class", getAnchorClass);
  updateHeader(selectedId);
  updateSvgPath(selectedId);
}

function secondsToString(seconds) {
  const date = new Date(null);
  date.setSeconds(seconds);
  const hhmm = date.toISOString().substr(11, 5);
  const hours = parseInt(hhmm.substr(0, 2));
  const minutes = parseInt(hhmm.substr(3));
  let retval = '';
  if (hours == 1) {
    retval = '1 hr';
  } else if (hours > 1) {
    retval = hours + ' hr';
  }
  if (hours > 0 && minutes > 0) {
    retval = retval + ' ';
  }
  if (minutes == 1) {
    retval = reval + '1 min';
  } else if (minutes > 1) {
    retval = retval + minutes + ' min';
  }
  return retval;
}

d3.json("tracks.json", (error, activityData) => {
  if (error) throw error;
  for (const id in activityData) {
    activities[id] = new Activity(id, activityData[id]);
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

  updateHeader(selectedId);
  if (centralMap) {
    initMap();
  }
});

function getActivityIndex() {
  const liNode = d3.select(".active").node().parentElement;
  const ulNode = liNode.parentElement;
  return Array.prototype.indexOf.call(ulNode.childNodes, liNode) - 1;
}

d3.select("body").on("keydown", () => {
  const key = d3.event.which;
  const index = getActivityIndex();
  if (key == 39 || key == 40) {
    selectActivity(index + 1);
  } else if (key == 37 || key == 38) {
    selectActivity(index - 1);
  }
});

d3.select("#previous").on("click", () => selectActivity(getActivityIndex() - 1));
d3.select("#next").on("click", () => selectActivity(getActivityIndex() + 1));
