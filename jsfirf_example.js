// License information: MIT License
//
// Copyright (c) Chris Schalick 2016 All Rights Reserved.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is furnished
// to do so, subject to the following conditions:
//
//   The above copyright notice and this permission notice shall be included in all
//   copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
// INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
// PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
// SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// Tree structure code creates an object hierarchy on demand
// inside an HTML table, allows click to expand / collapse
// to view and traverse the hierarchy.

var filtered = {};
filtered.pts = 10000;
filtered.zoom_pos = 0.5;
filtered.zoom_factor = 1;

function g(id){
  "use strict";
  return document.getElementById(id);
}

function show_response(id, bfr, bits){
  "use strict";
  var bytes = bits / 8, r = g(id), rctx = r.getContext("2d");
  var dvw = new DataView(bfr), data = jsfirf.prototype.get_array(dvw, bytes);
  rctx.fillStyle = "#f0f0f0";
  rctx.fillRect(0,0,300,100);
  var x, x1 = 0, x2, y1=50, y2;
  var dx = r.width / (data.length / filtered.zoom_factor);
  var pts_shown = r.width / dx;
  var st;
  if(filtered.zoom_factor == 1)
    st = 0;
  else
    st = Math.round(filtered.zoom_pos * filtered.pts - pts_shown / 2);
  if(st < 0)
    st = 0;
  rctx.strokeStyle = '#0000ff';
  for(x = st; x < data.length; x++){
    x2 = x1 + dx;
    y2 = 50 + data[x];
    rctx.beginPath();
    rctx.moveTo(x1, y1);
    rctx.lineTo(x2, y2);
    rctx.stroke();
    x1 = x2; y1 = y2;
    if(x1 > r.width)
      x = data.length;
  }
  rctx.strokeStyle = '#00ff00';
  rctx.beginPath();
  rctx.moveTo(filtered.zoom_pos * r.width, 0);
  rctx.lineTo(filtered.zoom_pos * r.width, 100);
  rctx.stroke();
}

function progress(label, val){
  var dv = g("progbar");
  var cv = g("progbar_cv");
  dv.innerHTML = " " + label + ": " + val + "%";
  var ctx = cv.getContext("2d");
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#00f000";
  ctx.fillRect(0, 0, val / 100 * cv.width, cv.height);
}

g("go").onclick = function(){
  "use strict";
  filtered.smprate = g("smprate").value * 1.0;
  filtered.lofreq = g("lopass").value * 1.0;
  filtered.hifreq = g("hipass").value * 1.0;
  var p0 = filtered.smprate / (filtered.lofreq / 10);
  var p1 = filtered.smprate / (filtered.hifreq * 10);
  if(p1 < 4)
    p1 = 4;
  var thisper, x, displ = filtered.pts;
  filtered.bits = g("bits").value * 1.0;
  filtered.bytes = filtered.bits / 8;
  filtered.inp = new ArrayBuffer(displ * filtered.bytes);
  filtered.chirp = new DataView(filtered.inp);
  var val, pos;
  for(x = 0; x < displ; x++)
  {
    pos = x / displ;
    thisper = p1 + (1 - pos) * (p0 - p1);
    val = Math.round(50 * Math.sin(x / thisper * 2 * Math.PI));
    if(filtered.bytes == 1)
      filtered.chirp.setInt8(x, val);
    else if(filtered.bytes == 2)
      filtered.chirp.setInt16(x * 2, val);
    else if(filtered.bytes == 4)
      filtered.chirp.setInt32(x * 4, val);
  }

  filtered.order = g("order").value * 1.0;
  filtered.win = g("fwindow").value;
  filtered.zoom_pos = 150;
  filtered.zoom_factor = 1;
  var filter = new jsfirf(filtered.smprate, filtered.lofreq, filtered.order, filtered.win);
  // blocking sequence
//  filtered.lopass = filter.lopass(filtered.inp, filtered.hifreq, filtered.bits);
//  filtered.hipass = filter.hipass(filtered.inp, filtered.lofreq, filtered.bits);
//  filtered.bandpass = filter.bandpass(filtered.inp, filtered.lofreq, filtered.hifreq, filtered.bits);
//  show_filtered();
  // non-blocking sequence
  var lo_cb = function(result){filtered.lopass = result; do_hi();};
  var do_hi = function(){filter.hipass_nb(filtered.inp, filtered.lofreq, filtered.bits, hi_cb, progress, "hipass");};
  var hi_cb = function(result){filtered.hipass = result; do_bd();};
  var do_bd = function(){filter.bandpass_nb(filtered.inp, filtered.lofreq, filtered.hifreq, filtered.bits, bd_cb, progress, "bandpass");};
  var bd_cb = function(result){filtered.bandpass = result; show_filtered();};
  filter.lopass_nb(filtered.inp, filtered.hifreq, filtered.bits, lo_cb, progress, "lowpass");
}

function show_filtered(){
  "use strict";
  show_response("input_response", filtered.inp, filtered.bits);
  show_response("lowpass_response", filtered.lopass, filtered.bits);
  show_response("highpass_response", filtered.hipass, filtered.bits);
  show_response("bandpass_response", filtered.bandpass, filtered.bits);
}

g("input_response").oncontextmenu = function(e){
  "use strict";
  e.preventDefault();
};

g("input_response").onmousedown = function(ev){
  "use strict";
  var cv = g("input_response"), click_x, min_x, max_x, ctr_x, wid_x;
  if(ev.x != undefined)
    click_x = ev.x;
  else 
    click_x = ev.clientX + document.body.scrollLeft +
              document.documentElement.scrollLeft;
  click_x -= cv.getBoundingClientRect().left;
  
  filtered.mouse = ev.button;
  if(ev.button != 0){
    filtered.zoom_factor = 1;
    filtered.zoom_pos = 0.5;
  } else {
    filtered.zoom_pos = (click_x / cv.width)
  }
  show_filtered();
  return false;
}

g("input_response").onmouseup = function(ev){
  "use strict";
  filtered.mouse = -1;
}

g("input_response").onmousemove = function(ev){
  "use strict";
  var cv = g("input_response"), click_x, min_x, max_x, ctr_x, wid_x;
  click_x = ev.clientX + document.body.scrollLeft +
            document.documentElement.scrollLeft;
  click_x -= cv.getBoundingClientRect().left;
  
  if(filtered.mouse == 0)
    filtered.zoom_pos = (click_x / cv.width)

  show_filtered();
  return false;
}

g("input_response").onwheel = function(ev){
  "use strict";
  if((ev.wheelDelta || ev.deltaY) > 0)
    filtered.zoom_factor++;
  else
    filtered.zoom_factor--;
  show_filtered();
  return false;
}
