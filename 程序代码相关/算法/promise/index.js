// promise 有三个状态：pending，fulfilled，or rejected；「规范 Promise/A+ 2.1」
const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

const resolvePromise = (promise2, x, resolve, reject) => {
  // 自己等待自己是错误的实现
  if (promise2 === x) {
    return reject(
      new TypeError("Chaining cycle detected for promise #<Promise>")
    );
  }
  // Promise/A+ 2.3.3.3.3 只能调用一次
  let called;
  // 后续的条件要严格判断 保证代码能和别的库一起使用
  // 判断是否为 thenable 对象或者 promise 函数
  if ((typeof x === "object" && x != null) || typeof x === "function") {
    try {
      // 为了判断 resolve 过的就不用再 reject 了（比如 reject 和 resolve 同时调用的时候）  Promise/A+ 2.3.3.1
      let then = x.then;
      if (typeof then === "function") {
        then.call(
          x,
          (y) => {
            if (called) return;
            called = true;
            // 递归解析过程 可能 promise 里还有 promise
            resolvePromise(resolvePromise, y, resolve, reject);
          },
          (r) => {
            if (called) return;
            called = true;
            reject(r);
          }
        );
      } else {
        resolve(x);
      }
    } catch (e) {
      if (called) return;
      called = true;
      reject(e);
    }
  } else {
    resolve(x);
  }
};

class newPromise {
  // new promise时， 需要传递一个executor()执行器，执行器立即执行；
  constructor(executor) {
    // promise 的默认状态是 pending；
    this.status = PENDING;
    // promise 有一个value保存成功状态的值，可以是undefined/thenable/promise；「规范 Promise/A+ 1.3」
    this.value = undefined;
    // promise 有一个reason保存失败状态的值；「规范 Promise/A+ 1.5」
    this.reason = undefined;

    this.fulfilledCallbacks = [];

    this.rejectedCallbacks = [];

    // promise 只能从pending到rejected, 或者从pending到fulfilled，状态一旦确认，就不会再改变；
    let resolve = (value) => {
      // 为了确保静态方法 resolve 等待执行, 递归解析
      if (value instanceof newPromise) {
        return value.then(resolve, reject);
      }

      if (this.status === PENDING) {
        this.status = FULFILLED;
        this.value = value;
        this.fulfilledCallbacks.forEach((fn) => fn());
      }
    };
    let reject = (reason) => {
      if (this.status === PENDING) {
        this.status = REJECTED;
        this.reason = reason;
        this.rejectedCallbacks.forEach((fn) => fn());
      }
    };

    try {
      // executor接受两个参数，分别是resolve和reject；
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  // 1. promise 必须有一个then方法，then 接收两个参数，分别是 promise 成功的回调 onFulfilled, 和 promise 失败的回调 onRejected；「规范 Promise/A+ 2.2」
  // 2. then 的参数 onFulfilled 和 onRejected 可以缺省，如果 onFulfilled 或者 onRejected不是函数，将其忽略，且依旧可以在下面的 then 中获取到之前返回的值；「规范 Promise/A+ 2.2.1、2.2.1.1、2.2.1.2」
  // 3. promise 可以 then 多次，每次执行完 promise.then 方法后返回的都是一个“新的promise"；「规范 Promise/A+ 2.2.7」
  // 4. 如果 then 的返回值 x 是一个普通值，那么就会把这个结果作为参数，传递给下一个 then 的成功的回调中；
  // 5. 如果 then 中抛出了异常，那么就会把这个异常作为参数，传递给下一个 then 的失败的回调中；「规范 Promise/A+ 2.2.7.2」
  //                          完全看调用的过程返回的是什么
  // 6. 如果 then 的返回值 x 是一个 promise，那么会等这个 promise 执行完，promise 如果成功，就走下一个 then 的成功；如果失败，就走下一个 then 的失败；如果抛出异常，就走下一个 then 的失败；「规范 Promise/A+ 2.2.7.3、2.2.7.4」
  // 7. 如果 then 的返回值 x 和 promise 是同一个引用对象，造成循环引用，则抛出异常，把异常传递给下一个 then 的失败的回调中；「规范 Promise/A+ 2.3.1」
  // 8. 如果 then 的返回值 x 是一个 promise，且 x 同时调用 resolve 函数和 reject 函数，则第一次调用优先，其他所有调用被忽略；「规范 Promise/A+ 2.3.3.3.3」

  then(onFulfilled, onRejected) {
    onFulfilled =
      typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (err) => {
            throw err;
          };
    // 返回一个新的 Promise
    const promise2 = new newPromise((resolve, reject) => {
      // 如果调用 then 时，promise 已经成功，则执行onFulfilled，参数是promise的value；
      if (this.status === FULFILLED) {
        setTimeout(() => {
          try {
            let x = onFulfilled(this.value);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }

      // 如果调用 then 时，promise 已经失败，那么执行onRejected, 参数是promise的reason
      // 如果 then 中抛出了异常，那么就会把这个异常作为参数，传递给下一个 then 的失败的回调onRejected；
      if (this.status === REJECTED) {
        setTimeout(() => {
          try {
            let x = onRejected(this.reason);
            resolvePromise(promise2, x, resolve, reject);
          } catch (e) {
            reject(e);
          }
        }, 0);
      }

      if (this.status === PENDING) {
        this.fulfilledCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onFulfilled(this.value);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });

        this.rejectedCallbacks.push(() => {
          setTimeout(() => {
            try {
              let x = onRejected(this.reason);
              resolvePromise(promise2, x, resolve, reject);
            } catch (e) {
              reject(e);
            }
          }, 0);
        });
      }
    });
    return promise2;
  }

  catch(callback) {
    return this.then(null, callback);
  }

  finally(callback) {
    return this.then(
      (value) => newPromise.resolve(callback()).then(() => value),
      (reason) =>
        Promise.resolve(callback()).then(() => {
          throw reason;
        })
    );
  }
  static resolve(value) {
    return new newPromise((resolve, reject) => {
      resolve(value);
    });
  }
  static reject(reason) {
    return new newPromise((resolve, reject) => {
      reject(reason);
    });
  }
  static all(values) {
    if (!Array.isArray(values)) {
      const type = typeof values;
      return new TypeError(
        `TypeError: ${values} ${type} is not iterable`
      );
    }
    return new newPromise((resolve, reject) => {
      let resultArr = [];
      let orderIndex = 0;
      const processResultByKey = (val, i) => {
        resultArr[i] = val;
        if (++orderIndex === values.length) {
          resolve(resultArr);
        }
      };

      for (let i = 0; i < values.length; i++) {
        let value = values[i];
        if (value && typeof value.then === "function") {
          value.then((value) => {
            processResultByKey(value, i);
          }, reject);
        } else {
          processResultByKey(value, i);
        }
      }
    });
  }
  static race(values) {
    return new Promise((resolve, reject) => {
      for (let promise of values) {
        if (
          typeof promise === "object" &&
          typeof promise.then === "function"
        ) {
          // 数组传进来的项是一个Promise实例，执行then方法。
          // resolve只有一个，那个实例对象最先执行完就会使用这个resolve
          promise.then(resolve, reject);
        } else {
          // 不是Promise实例对象直接返回当前值
          resolve(promise);
        }
      }
    });
  }
}

// Promise/A+规范提供了一个专门的测试脚本，可以测试所编写的代码是否符合Promise/A+的规范。
// 安装测试脚本：promises-aplus-tests
// 增加以下代码
// promises-aplus-tests index.js


newPromise.defer = newPromise.deferred = function () {
  let dfd = {};
  dfd.promise = new newPromise((resolve, reject) => {
    dfd.resolve = resolve;
    dfd.reject = reject;
  });
  return dfd;
};


module.exports = newPromise