/*
License information: MIT License

Copyright (c) Chris Schalick 2016 All Rights Reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Tree structure code creates an object hierarchy on demand
inside an HTML table, allows click to expand / collapse
to view and traverse the hierarchy.
*/

function jsfirf(smp, trans, order, win){
  "use strict";
  this.smp_freq = smp;
  this.trans_freq = trans;
  this.order = order;
  if((this.order % 2) == 1)
    this.order++;
  if(typeof win == "undefined")
    this.win_type = "rectangular";
  else
    this.win_type = win;
  this.frq_ratio = trans / smp;
  this.nmax = this.order / 2;
  this.nmin = -1 * this.nmax;

  this.set_window();
  this.set_weights();
  this.set_taps();
};

jsfirf.prototype.set_window = function(){
  "use strict";
  var n;
  this.win_weights = [];
  if(this.win_type == "rectangular"){
    for(n = 0; n <= this.order; n++)
      this.win_weights.push(1.0);
  } else if(this.win_type == "bartlett"){
    for(n = 0; n <= this.order; n++)
      this.win_weights.push(1 - (2 * Math.abs(n - this.nmax) / this.order));
  } else if(this.win_type == "hanning"){
    for(n = 0; n <= this.order; n++)
      this.win_weights.push(0.5 - 0.5 * Math.cos(2 * Math.PI * n / this.order));
  } else if(this.win_type == "hamming"){
    for(n = 0; n <= this.order; n++)
      this.win_weights.push(0.54 - 0.46 * Math.cos(2 * Math.PI * n / this.order));
  } else if(this.win_type == "blackman"){
    for(n = 0; n <= this.order; n++)
      this.win_weights.push(0.42 - 0.5 * Math.cos(2 * Math.PI * n / this.order) + 0.08 * Math.cos(4 * Math.PI * n / this.order));
  }
};

jsfirf.prototype.set_weights = function(){
  "use strict";
  this.weights = [];
  var x;
  var norm_freq = this.trans_freq / this.smp_freq;
  for(x = this.nmin; x <= this.nmax; x++)
    if(x == 0)
      this.weights.push(2 * norm_freq);
    else
      this.weights.push(Math.sin(2 * Math.PI * norm_freq * x) / (Math.PI * x));
};

jsfirf.prototype.set_taps = function(){
  "use strict";
  var n;
  this.taps = [];
  for(n = this.nmin; n <= this.nmax; n++)
    this.taps.push(this.win_weights[n - this.nmin] * this.weights[n - this.nmin]);
};

jsfirf.prototype.unity = function(){
  "use strict";
  var n;
  this.taps = [];
  for(n = this.nmin; n <= this.nmax; n++){
    if(n == 0)
      this.taps.push(1.0);
    else
      this.taps.push(0);
  }
};

jsfirf.prototype.set_val = function(dvw, idx, bytes, val){
  "use strict";
  var mx = Math.pow(2, (8 * bytes) - 1);
  var abs = Math.abs(val);
  var clip = abs > mx;
  var clipped;
  if(clip)
    clipped = val / (abs + 1) * mx;
  else
    clipped = val;
  if(bytes == 1){
    dvw.setInt8(idx, clipped);
  } else if(bytes == 2){
    dvw.setInt16(idx << 1, clipped);
  } else if(bytes == 4){ 
    dvw.setInt32(idx << 2, clipped);
  }
}

jsfirf.prototype.get_val = function(dvw, idx, bytes){
  "use strict";
  var val;
  if(bytes == 1)
    val = dvw.getInt8(idx);
  else if(bytes == 2)
    val = dvw.getInt16(idx << 1);
  else if(bytes == 4)
    val = dvw.getInt32(idx << 2);
  return val;
}

jsfirf.prototype.get_array = function(dvw, bytes){
  "use strict";
  var val, arr = [];
  for(var x = 0; x < dvw.byteLength; x += bytes){
    if(bytes == 1)
      val = dvw.getInt8(x);
    else if(bytes == 2)
      val = dvw.getInt16(x);
    else if(bytes == 4)
      val = dvw.getInt32(x);
    arr.push(val);
  }
  return arr;
}

jsfirf.prototype.chunk = function(st, en, ivw, ovw, bytes, next, prog_cb, label, val){
  var filter = this;
  var call = function(){filter.apply_piece(st, en, ivw, ovw, bytes); prog_cb(label, val); if(next != null)setTimeout(next, 10)};
  return call;
}

jsfirf.prototype.nb_cb = function(ovw, cb){
  var call = function(){cb(ovw.buffer);};
  return call;
}

jsfirf.prototype.apply_chain = function(len, ivw, ovw, bytes, cb, prog_cb, label){
  var loops = 20;
  var inc = parseInt(len / loops);
  var filter = this;
  var last = this.nb_cb(ovw, cb);
  var last_chunk = this.chunk(0, inc, ivw, ovw, bytes, last, prog_cb, label, 100);
  var call, prev = last_chunk, en;
  for(var x = inc; x < len; x = x + inc){
    en = x + inc;
    if(en > len)
      en = len;
    call = this.chunk(x, en, ivw, ovw, bytes, prev, prog_cb, label, Math.round(100 - 100 * (x / len)));
    prev = call;
  }
  return call;
}

jsfirf.prototype.apply_piece = function(st, en, ivw, ovw, bytes){
  for(var x = st; x < en; x++){
    result = 0;
    tapmax = this.order;
    if(x < this.order)
      result = 0; 
    else for(var n = 0; n <= tapmax; n++)
      result += this.taps[n] * this.get_val(ivw, x - tapmax + n, bytes);
    this.set_val(ovw, x, bytes, result);
  }
}

jsfirf.prototype.apply_nb = function(data, bits, cb, prog_cb, label){
  "use strict";
  var result, tapmax, filtered = new ArrayBuffer(data.byteLength);
  var ivw = new DataView(data);
  var ovw = new DataView(filtered);
  var bytes = bits / 8;
  var len = data.byteLength / bytes;

  // create a chain of function call closures that are 0:n, n:2n, 2n:3n, ...M-n:M
  // 1) make the indexed piece routine
  // 2) make the progress troutine
  // 3) make a recursive tree of piece-wise closure calls with progress callbacks
  //    with the setTimeout calls on the call to the next piece closure
  // TODO:
  // - be smart about how many are created (ie, only enough for 1/4 second updates?)

  var calls = this.apply_chain(len, ivw, ovw, bytes, cb, prog_cb, label);
  calls();

  return filtered;
};

jsfirf.prototype.apply = function(data, bits){
  "use strict";
  var result, tapmax, filtered = new ArrayBuffer(data.byteLength);
  var ivw = new DataView(data);
  var ovw = new DataView(filtered);
  var bytes = bits / 8;
  var len = data.byteLength / bytes;

  for(var x = 0; x < len; x++){
    result = 0;
    tapmax = this.order;
    if(x < this.order)
      result = 0; //this.get_val(ivw, x, bytes);
    else for(var n = 0; n <= tapmax; n++)
      result += this.taps[n] * this.get_val(ivw, x - tapmax + n, bytes);
    this.set_val(ovw, x, bytes, result);
  }

  return filtered;
};

jsfirf.prototype.lopass = function(data, trans, bits){
  "use strict";
  var frate = this.smp_freq, forder = this.order, fwin = this.win_type;
  if(typeof frate == "undefined")
    return [];
  if(typeof forder == "undefined")
    forder = 20;
  if(typeof fwin == "undefined")
    fwin = "rectangular";
  var filter = new jsfirf(frate, trans, forder, fwin);
  var filtered = filter.apply(data, bits);
  return filtered;
};

jsfirf.prototype.hipass = function(data, trans, bits){
  "use strict";
  var frate = this.smp_freq, forder = this.order, fwin = this.win_type;
  if(typeof frate == "undefined")
    return [];
  if(typeof forder == "undefined")
    forder = 20;
  if(typeof fwin == "undefined")
    fwin = "rectangular";
  var lowpass = new jsfirf(frate, trans, forder, fwin);
  var allpass = new jsfirf(frate, trans, forder, fwin);
  allpass.unity();
  var low = lowpass.apply(data, bits);
  var all = allpass.apply(data, bits);
  var lowvw = new DataView(low);
  var allvw = new DataView(all);
  var high = new ArrayBuffer(data.byteLength);
  var highvw = new DataView(high);
  var bytes = bits / 8;
  var val, last = low.byteLength / bytes;
  for(var x = 0; x < last; x++){
    val = this.get_val(allvw, x, bytes) - this.get_val(lowvw, x, bytes);
    this.set_val(highvw, x, bytes, val);
  }
  return high;
};

jsfirf.prototype.bandpass = function(data, lotrans, hitrans, bits){
  "use strict";
  var frate = this.smp_freq, forder = this.order, fwin = this.win_type;
  if(typeof frate == "undefined")
    return [];
  if(typeof forder == "undefined")
    forder = 20;
  if(typeof fwin == "undefined")
    fwin = "rectangular";
  var hipass = this.hipass(data, lotrans, bits);
  var bandpass = this.lopass(hipass, hitrans, bits);
  return bandpass;
};

jsfirf.prototype.lopass_nb = function(data, trans, bits, cb, prog_cb, label){
  "use strict";
  var frate = this.smp_freq, forder = this.order, fwin = this.win_type;
  if(typeof frate == "undefined")
    return [];
  if(typeof forder == "undefined")
    forder = 20;
  if(typeof fwin == "undefined")
    fwin = "rectangular";
  var filter = new jsfirf(frate, trans, forder, fwin);
  filter.apply_nb(data, bits, cb, prog_cb, label);
};

jsfirf.prototype.hipass_nb = function(data, trans, bits, cb, prog_cb, label){
  "use strict";
  var frate = this.smp_freq, forder = this.order, fwin = this.win_type;
  if(typeof frate == "undefined")
    return [];
  if(typeof forder == "undefined")
    forder = 20;
  if(typeof fwin == "undefined")
    fwin = "rectangular";
  var lowpass = new jsfirf(frate, trans, forder, fwin);
  var allpass = new jsfirf(frate, trans, forder, fwin);
  allpass.unity();
  var filter = this;
  var low;
  var low_cb = function(result){low = result; do_all()};
  var do_all = function(){allpass.apply_nb(data, bits, all_cb, prog_cb, label);};
  var all_cb = function(result){
    var all = result;
    var lowvw = new DataView(low);
    var allvw = new DataView(all);
    var high = new ArrayBuffer(data.byteLength);
    var highvw = new DataView(high);
    var bytes = bits / 8;
    var val, last = low.byteLength / bytes;
    for(var x = 0; x < last; x++){
      val = filter.get_val(allvw, x, bytes) - filter.get_val(lowvw, x, bytes);
      filter.set_val(highvw, x, bytes, val);
    }
    cb(high);
  };

  lowpass.apply_nb(data, bits, low_cb, prog_cb, label);
};

jsfirf.prototype.bandpass_nb = function(data, lotrans, hitrans, bits, cb, prog_cb, label){
  "use strict";
  var frate = this.smp_freq, forder = this.order, fwin = this.win_type;
  if(typeof frate == "undefined")
    return [];
  if(typeof forder == "undefined")
    forder = 20;
  if(typeof fwin == "undefined")
    fwin = "rectangular";
  var filter = this;
  var hi_cb = function(hipass){filter.lopass_nb(hipass, hitrans, bits, cb, prog_cb, label);};
  filter.hipass_nb(data, lotrans, bits, hi_cb, prog_cb, label);
};
