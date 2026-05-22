import type { Meta, StoryObj } from '@storybook/angular';
import { ButtonComponent } from './button.component';
import { expect, within } from '@storybook/test';

const meta: Meta<ButtonComponent> = {
  component: ButtonComponent,
  title: 'Components/Button',
  tags: ['autodocs'],
  argTypes: {
    label: {
      control: 'text',
      description: 'Button label text',
    },
    color: {
      control: 'select',
      options: ['', 'primary', 'accent', 'warn'],
      description: 'Button color theme',
    },
    clickEvent: {
      action: 'clicked',
      description: 'Event emitted when button is clicked',
    },
  },
};
export default meta;

type Story = StoryObj<ButtonComponent>;

export const Default: Story = {
  args: {
    label: 'Click me',
    color: '',
  },
};

export const Primary: Story = {
  args: {
    label: 'Primary Button',
    color: 'primary',
  },
};

export const Accent: Story = {
  args: {
    label: 'Accent Button',
    color: 'accent',
  },
};

export const Warn: Story = {
  args: {
    label: 'Warning Button',
    color: 'warn',
  },
};

export const InteractionTest: Story = {
  args: {
    label: 'Test Button',
    color: 'primary',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Test Button/gi)).toBeTruthy();
  },
};
