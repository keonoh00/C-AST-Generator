#ifndef FAKE_WINDOWS_H
#define FAKE_WINDOWS_H

/* Basic Windows types */
typedef unsigned long DWORD;
typedef int BOOL;
typedef unsigned long ULONG;
typedef unsigned short WORD;
typedef unsigned char BYTE;
typedef void *HANDLE;
typedef HANDLE HWND;
typedef char CHAR;
typedef wchar_t WCHAR;
typedef WCHAR *LPWSTR;
typedef const CHAR *LPCSTR;
typedef const WCHAR *LPCWSTR;
typedef void *LPVOID;
typedef long LONG;
typedef unsigned int UINT;

/* Null and boolean */
#ifndef FALSE
#define FALSE 0
#endif
#ifndef TRUE
#define TRUE 1
#endif
#ifndef NULL
#define NULL ((void *)0)
#endif

/* Calling convention */
#ifndef WINAPI
#define WINAPI
#endif

/* Annotations */
#ifndef IN
#define IN
#endif
#ifndef OUT
#define OUT
#endif
#ifndef CONST
#define CONST const
#endif

/* Common constants */
#define ERROR_SUCCESS 0L

/* Stubbed functions */
WINAPI void ExitProcess(UINT uExitCode);
WINAPI void Sleep(DWORD dwMilliseconds);

#endif /* FAKE_WINDOWS_H */