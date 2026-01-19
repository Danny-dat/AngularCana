import { notify } from './notify';

describe('notify', () => {
  it('should not throw without vibration support', () => {
    const original = (navigator as any).vibrate;
    try {
      (navigator as any).vibrate = undefined;
      expect(() => notify()).not.toThrow();
    } finally {
      (navigator as any).vibrate = original;
    }
  });

  it('should call navigator.vibrate when available', () => {
    const original = (navigator as any).vibrate;
    const spy = jasmine.createSpy('vibrate');
    try {
      (navigator as any).vibrate = spy;
      notify();
      expect(spy).toHaveBeenCalled();
    } finally {
      (navigator as any).vibrate = original;
    }
  });
});
