function* fibonacci() {
    var fn1 = 0;
    var fn2 = 1;
    while (true) {  
      var current = fn1;
      fn1 = fn2;
      fn2 = current + fn1;
      console.log("Yielding: " + current);
      var reset = yield current;
      if (reset) {
          fn1 = 0;
          fn2 = 1;
      }
    }
  }
  
  var sequence = fibonacci();
  console.log(sequence.next().value);     // 0
  console.log(sequence.next().value);     // 1
  console.log(sequence.next().value);     // 1
  console.log(sequence.next().value);     // 2
  console.log(sequence.next().value);     // 3
  console.log(sequence.next().value);     // 5
  console.log(sequence.next().value);     // 8
  console.log(sequence.next(true).value); // 0
  console.log(sequence.next().value);     // 1
  console.log(sequence.next().value);     // 1
  console.log(sequence.next().value);     // 2