import { fork } from 'node:child_process';
const child = fork(process.argv[2], [process.argv[3]], { execArgv: [], stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
child.once('message', () => process.send({ childPid: child.pid }, () => process.exit(0)));
