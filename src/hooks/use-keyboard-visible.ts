import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Tracks whether the software keyboard is on screen.
 *
 * Used to hide the tab bar while the user is typing.
 */
export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
