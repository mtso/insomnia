# Insomnia CLI

The Insomnia CLI runner.

## Usage

```
Insomnia REST CLI Runner

  Runs API tests like a robot, not a human.

Synopsis

  $ insomniac [filepath to Insomnia export] --request-groups [folder]
  --environment [sub environment]

Options

  -g, --request-groups folder   (REQUIRED) The folder of requests to run. The folder names are found in the
                                insomnia workspace.
  -e, --environment name        (REQUIRED) Name of sub environment which contains environment variables.
  -o, --output filepath         Filepath to save output results.
  -d, --delay milliseconds      Milliseconds to delay each request by (defaults to 0).
  -h, --help                    Print this usage guide.
```
