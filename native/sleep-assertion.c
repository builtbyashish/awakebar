/*
 * Holds a macOS "no idle sleep" power assertion for as long as this process
 * lives, under a name of our choosing.
 *
 * Electron's powerSaveBlocker does the same job, but IOKit takes the assertion
 * name from the caller and Electron hardcodes its own, so `pmset -g assertions`
 * reports AwakeBar's assertion as "Electron". IOPMAssertionCreateWithName is
 * the only way to set that string, and it is not reachable from JavaScript.
 *
 * The parent holds our stdin open and closes it to let us go. Reading to EOF
 * means a crashed parent releases the assertion too, and the kernel releases it
 * regardless once the process exits, so a stuck assertion is not possible.
 */
#include <CoreFoundation/CoreFoundation.h>
#include <IOKit/pwr_mgt/IOPMLib.h>
#include <errno.h>
#include <stdio.h>
#include <unistd.h>

int main(void) {
  IOPMAssertionID assertion = kIOPMNullAssertionID;

  // kIOPMAssertionTypeNoIdleSleep keeps the system awake while still allowing
  // the display to sleep -- the same type Electron's 'prevent-app-suspension'
  // uses, so behaviour is unchanged.
  IOReturn result = IOPMAssertionCreateWithName(
      kIOPMAssertionTypeNoIdleSleep,
      kIOPMAssertionLevelOn,
      CFSTR("AwakeBar"),
      &assertion);

  if (result != kIOReturnSuccess) {
    fprintf(stderr, "could not create power assertion: 0x%08x\n", result);
    return 1;
  }

  // Tell the parent the assertion is up before it reports success anywhere.
  puts("held");
  fflush(stdout);

  char discard[64];
  for (;;) {
    ssize_t got = read(STDIN_FILENO, discard, sizeof discard);
    if (got == 0) break;
    if (got < 0 && errno != EINTR) break;
  }

  IOPMAssertionRelease(assertion);
  return 0;
}
