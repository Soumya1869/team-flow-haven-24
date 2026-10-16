package dev.teamspace;

public class ApiException extends RuntimeException {
    final int status; final String code;
    public ApiException(int status, String code, String detail) { super(detail); this.status=status; this.code=code; }
    public static ApiException missing() { return new ApiException(404,"NOT_FOUND","Resource not found"); }
    public static ApiException forbidden() { return new ApiException(403,"FORBIDDEN","Insufficient workspace permissions"); }
    public static ApiException unauthorized() { return new ApiException(401,"UNAUTHENTICATED","Please sign in to continue"); }
}
