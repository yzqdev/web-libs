import Vue from "vue";
import App from "./App.vue";
import router from "./router";

import Copy from "vue-clipboard2";
Vue.use(Copy);

import kui from "../components";
import "../components/styles/index.less";
Vue.use(kui);

import "./assets/css/index.less";
import "./assets/img/theme.jpg";
import Demo from "./components/demo";
Vue.component("demo", Demo);

Vue.config.productionTip = false;

new Vue({
  router,
  render: (h) => h(App),
}).$mount("#app");
