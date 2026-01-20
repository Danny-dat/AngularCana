import { vibrate } from './notify';

describe('notify (vibrate)', () => {
  it('should not throw without vibration support', async () => {
    const original = (navigator as any).vibrate;
    try {
      (navigator as any).vibrate = undefined;
      await expectAsync(vibrate()).toBeResolved();
    } finally {
      (navigator as any).vibrate = original;
    }
  });

  it('should call navigator.vibrate when available', async () => {
    const original = (navigator as any).vibrate;
    const spy = jasmine.createSpy('vibrate');
    try {
      (navigator as any).vibrate = spy;
      await vibrate();
      expect(spy).toHaveBeenCalled();
    } finally {
      (navigator as any).vibrate = original;
    }
  });

  it('should pass the given duration', async () => {
    const original = (navigator as any).vibrate;
    const spy = jasmine.createSpy('vibrate');
    try {
      (navigator as any).vibrate = spy;
      await vibrate(250);
      expect(spy).toHaveBeenCalledWith(250);
    } finally {
      (navigator as any).vibrate = original;
    }
  });
});
