// @flow
// import * as electron from 'electron';
// import { showAlert, showPrompt } from '../../../../insomnia-app/app/ui/components/modals/index';

async function showAlert(message) {
  await showAlert('[ALERT] ' + message);
}

async function showPrompt(message) {
  return promptStdin('[PROMPT] ' + message);
}

async function promptStdin(message) {
  console.log(message);
  const stdin = process.openStdin();
  return new Promise(resolve => {
    stdin.addListener('data', buf => {
      resolve(buf.toString().trim());
      stdin.destroy();
    });
  });
}

import type { RenderPurpose } from '../../common/render';
import { RENDER_PURPOSE_GENERAL, RENDER_PURPOSE_SEND } from '../../common/render';

export function init(renderPurpose: RenderPurpose = RENDER_PURPOSE_GENERAL): { app: Object } {
  return {
    app: {
      alert(title: string, message?: string): Promise<void> {
        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve();
        }

        return showAlert(JSON.stringify({ title, message }));
      },
      prompt(
        title: string,
        options?: {
          label?: string,
          defaultValue?: string,
          submitName?: string,
          cancelable?: boolean
        }
      ): Promise<string> {
        options = options || {};

        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve(options.defaultValue || '');
        }

        return showPrompt(JSON.stringify({ title, ...options }));
        // return new Promise((resolve, reject) => {
        //   showPrompt({
        //     title,
        //     ...(options || {}),
        //     onCancel() {
        //       reject(new Error(`Prompt ${title} cancelled`));
        //     },
        //     onComplete(value: string) {
        //       resolve(value);
        //     }
        //   });
        // });
      },
      getPath(name: string): string {
        switch (name.toLowerCase()) {
          case 'desktop':
            return '~/.insomnia/desktop'; // electron.remote.app.getPath('desktop');
          default:
            throw new Error(`Unknown path name ${name}`);
        }
      },
      async showSaveDialog(options: { defaultPath?: string } = {}): Promise<string | null> {
        if (renderPurpose !== RENDER_PURPOSE_SEND) {
          return Promise.resolve(null);
        }

        return new Promise(resolve => {
          const saveOptions = {
            title: 'Save File',
            buttonLabel: 'Save',
            defaultPath: options.defaultPath
          };

          // electron.remote.dialog.showSaveDialog(saveOptions, filename => {
          //   resolve(filename || null);
          // });
        });
      }
    }
  };
}
