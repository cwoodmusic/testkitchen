"""Real touch coordinates for the shared fixed-base movement joystick."""
import math


def joystick_geometry(page, selector='.coda-joystick'):
    base=page.locator(selector).bounding_box()
    thumb=page.locator(selector+' .coda-joystick-thumb').bounding_box()
    if base is None or thumb is None:
        raise AssertionError('The real movement joystick and thumb must be visible')
    return {'base':base,'thumb':thumb,'radius':max(20,(base['width']-thumb['width'])/2-8),
            'x':base['x']+base['width']/2,'y':base['y']+base['height']/2}


def joystick_point(page,x=1,y=0,touch_id=1,selector='.coda-joystick'):
    """x/y are raw fractions of the thumb's travel, not screen coordinates."""
    geometry=joystick_geometry(page,selector)
    return {'x':geometry['x']+x*geometry['radius'],'y':geometry['y']+y*geometry['radius'],
            'id':touch_id,'radiusX':3,'radiusY':3,'force':1}


def direction_point(page,label,touch_id=1,selector='.coda-joystick'):
    vectors={'Move up':(0,-1),'Move up right':(1,-1),'Move right':(1,0),
             'Move down right':(1,1),'Move down':(0,1),'Move down left':(-1,1),
             'Move left':(-1,0),'Move up left':(-1,-1)}
    x,y=vectors[label];length=math.hypot(x,y)
    return joystick_point(page,x/length,y/length,touch_id,selector)
