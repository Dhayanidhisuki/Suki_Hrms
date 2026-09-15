import { calculatePayrollRun } from './src/lib/payrollCalculation';

calculatePayrollRun(36)
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error('ERROR:', e.message);
    process.exit(1);
  });
