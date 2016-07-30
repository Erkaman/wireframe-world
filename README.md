# wireframe-world

This demo draws an infinite, vaporwave-like world using the WebGL
framework [regl](https://github.com/mikolalysenko/regl). A link to the
demo is [here](http://erkaman.github.io/wireframe-world/www/demo.html). It should look
like the below:

![Animated](images/anim.gif)

And click below for a longer video of the demo:

[![Result](http://img.youtube.com/vi/tE9geTQxgZc/0.jpg)](https://www.youtube.com/watch?v=tE9geTQxgZc)


## Implementation Details

As for the implementation, it is not very difficult stuff; I divide up
the world into chunks(just like in Minecraft), and as the camera
traverses the world, the chunks that become out of range are thrown
away and are no longer rendered. And in the far away horizon I keep adding
new chunks, to give the illusion that the world is infinite.

## Build

To run the demo locally on your computer, first change your directory to the directory of the project, then run

```bash
npm install
```

To then run the demo, do

```bash
npm start
```


## TODO

Port the program into screensavers for OS X, Windows and Linux. 
