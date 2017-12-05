#!/usr/bin/env python3

# pip3 install flask requests py-dateutil
# export STRAVA_API_CLIENT_ID=12345
# export STRAVA_API_SECRET=c0ffee0000000000000000000000000000000001
# FLASK_APP=sfpaths.py flask run

import sys
import io
import os
import urllib.parse
from flask import Flask, request, redirect, session, url_for, escape
from flask import Response, stream_with_context
import requests
import dateutil.parser
from datetime import timedelta

STRAVA_API_CLIENT_ID = os.environ['STRAVA_API_CLIENT_ID']
STRAVA_API_SECRET = os.environ['STRAVA_API_SECRET']
ACTIVITY_TYPE_FILTER = 'Windsurf'

app = Flask(__name__)

def process_activity(activity, output):
    id = str(activity['id'])
    output.write(
        '<a href="https://www.strava.com/activities/{0}">{1} {0}</a><br>\n'.format(
        activity['type'], id))
    track = session['tracks'][id] = {}
    track['date'] = activity['start_date_local']
    track['max_speed'] = activity['max_speed']
    track['average_speed'] = activity['average_speed']
    track['distance'] = activity['distance']
    track['duration'] = activity['elapsed_time']

def process_stream(id, latlngs, times, output):
    assert(latlngs['type'] == 'latlng')
    assert(times['type'] == 'time')
    latlngs = latlngs['data']
    times = times['data']
    output.write('{0} lat-long points loaded<br>\n'.format(len(latlngs)))
    track = session['tracks'][str(id)]
    track['coords'] = latlngs
    track['times'] = times

def export_json(filename, activity_ids):
    tracks = session['tracks']
    jsonfile = open(filename, 'w')
    jsonfile.write('{\n')
    first_activity = True
    for i, activity_id in enumerate(activity_ids):
        track = session['tracks'][str(activity_id)]
        if i:
            jsonfile.write(',')
        jsonfile.write('"{}": {{\n'.format(activity_id))
        jsonfile.write('"date": "{}",\n'.format(track['date']))
        jsonfile.write('"max_speed": {},\n'.format(track['max_speed']))
        jsonfile.write('"average_speed": {},\n'.format(track['average_speed']))
        jsonfile.write('"distance": {},\n'.format(track['distance']))
        jsonfile.write('"duration": {},\n'.format(track['duration']))
        jsonfile.write('"track": [')
        coords = track['coords']
        times = track['times']
        date = dateutil.parser.parse(track['date'], ignoretz=True)
        for j, latlng in enumerate(coords):
            if j:
                jsonfile.write(',')
            lat = latlng[0]
            lon = latlng[1]
            jsonfile.write('\n{}, {}, {}'.format(lat, lon, times[j]))
        jsonfile.write('\n]}')
    jsonfile.write('}\n')
    jsonfile.close()
    import json
    json.loads(open(filename).read())

def login_and_redirect(endpoint):
    base_url = request.base_url
    base_url = base_url[:base_url.rfind('/')]
    query = urllib.parse.urlencode({
        'client_id': STRAVA_API_CLIENT_ID,
        'response_type': 'code',
        'state': endpoint,
        'redirect_uri': base_url + '/token_exchange'})
    return redirect('https://www.strava.com/oauth/authorize?' + query)

@app.route("/")
def index():
    if 'username' not in session:
        return login_and_redirect('index')
    return '''
        <p>logged in as <b>{}</b></p>
        <a href="create_json">generate JSON file</a>
        '''.format(escape(session['username']))

@app.route('/create_json')
def create_json():
    if 'username' not in session:
        return login_and_redirect('create_json')
    def generate():
        yield "<p>Generating JSON...</p>"
        req = requests.get('https://www.strava.com/api/v3/athlete/activities', data = {
            'after': 0,
            'access_token': session['access_token']})
        html = io.StringIO()
        activity_ids = []
        session['tracks'] = {}
        for activity in req.json():
            if activity.get('type') == ACTIVITY_TYPE_FILTER:
                activity_ids.append(activity['id'])
                process_activity(activity, html)
        html.write('<br>\n')
        yield html.getvalue()
        for id in activity_ids:
            url = 'https://www.strava.com/api/v3/activities/{}/streams/latlng,time'.format(id)
            req = requests.get(url, data = {
                'access_token': session['access_token']
            })
            html = io.StringIO()
            process_stream(id, req.json()[0], req.json()[1], html)
            yield html.getvalue()
        export_json('docs/tracks.json', activity_ids)
        yield "<br><b>docs/tracks.json</b> has been generated"
    return  Response(stream_with_context(generate()))

@app.route('/token_exchange')
def accept_token():
    code = request.args.get('code', '')
    state = request.args.get('state', 'index')
    req = requests.post('https://www.strava.com/oauth/token', data = {
        'client_id': STRAVA_API_CLIENT_ID,
        'code': code,
        'client_secret': STRAVA_API_SECRET})
    athlete = req.json()['athlete']
    session['username'] = athlete['email']
    session['access_token'] = req.json()['access_token']
    print("{} has logged in".format(session['username']))
    return redirect(url_for(state))

app.secret_key = os.urandom(24)
