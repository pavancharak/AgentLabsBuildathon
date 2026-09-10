import { createApp } from './server';

const PORT = Number(process.env.PORT) || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`parmana-exp-demo listening on port ${PORT}`);
});
