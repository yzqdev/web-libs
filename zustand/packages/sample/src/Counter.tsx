import { create } from "zustand/src/index";

type Store = {
  count: number;
  counters: string[];
  inc: () => void;
  getSetFun: () => void;
  insertCounter:()=>void
  insertCounterI:()=>void
};

const useStore = create<Store>()((set) => ({
  count: 1,
  counters: ['a','b'],
  inc: () => set((state) => ({ count: state.count + 1 })),
  getSetFun() {
    console.log(set);
  },
  insertCounter() {
    set((state) => {
      state.counters.push("hello"+Math.floor(Math.random()*40));
      return state ;
    });
  },  insertCounterI() {
    set((state) => {
     
      return {
        ...state,
        counters: [...state.counters, "hello" + Math.floor(Math.random() * 40)],
      };
    });
  },
}));

export function Counter() {
  const { count, inc, getSetFun, counters, insertCounter,insertCounterI } = useStore();
  return (
    <div>
      <span>{count}</span>
      <button onClick={inc}>one up</button>
      <button onClick={getSetFun}>set ?</button>
<hr/>
      {counters.map(i=><div>{i}</div>)}

      <button onClick={insertCounter}>添加counter</button>
      <button onClick={insertCounterI}>添加counter 正确</button>
    </div>
  );
}
