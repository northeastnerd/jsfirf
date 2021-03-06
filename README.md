# jsfirf
Zero dependency Javascript FIR filter library 

## Summary
This is an FIR library suitable for use in browser applications doing lightweight filtering. It's relatively low footprint, you can operate on arrays of 8, 16 or 32 bit integers and filter depths up to 2000 are workable with sequences of a few 10's of thousands of samples. 

It's pretty small (1489 bytes minified, gzipped) and gives simple low pass, high pass and band pass methods that make use of cooperative multi-tasking to allow operating in browser with large data sets.

There is a live demo here: https://rawgit.com/northeastnerd/jsfirf/master/jsfirf.html

## Version 0.2
Add a progress bar to the demo and cooperative multi-tasking / UI updates during filtering allowing large data sets to succeed without Aw Snap messages.

## Version 0.1
Functional, the demo has ugly aliasing in the input waveform but the filters do the right thing. Large data sets (megabytes) are challenging, cooperative release of browser cpu planned for next release.
