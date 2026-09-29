import { Stack } from 'expo-router';
import type { SFSymbol } from 'sf-symbols-typescript';

export interface HeaderMenuItem {
  label: string;
  icon?: SFSymbol;
  destructive?: boolean;
  onPress: () => void;
}

export interface HeaderActionsProps {
  /** Overflow menu (…) shown before the button. */
  menu?: { label: string; items: HeaderMenuItem[] };
  /** The primary text button, e.g. "End". */
  button?: { label: string; onPress: () => void; tint?: string; prominent?: boolean };
}

/** Right-hand navigation-bar items, as native iOS toolbar buttons. */
export function HeaderActions({ menu, button }: HeaderActionsProps) {
  return (
    <Stack.Toolbar placement="right">
      {menu && (
        <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel={menu.label}>
          {menu.items.map((item) => (
            <Stack.Toolbar.MenuAction key={item.label} icon={item.icon} destructive={item.destructive} onPress={item.onPress}>
              {item.label}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      )}
      {button && (
        <Stack.Toolbar.Button
          onPress={button.onPress}
          tintColor={button.tint}
          variant={button.prominent ? 'prominent' : 'plain'}
        >
          {button.label}
        </Stack.Toolbar.Button>
      )}
    </Stack.Toolbar>
  );
}
