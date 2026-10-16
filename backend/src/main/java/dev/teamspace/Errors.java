package dev.teamspace;

import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import java.util.LinkedHashMap;

@RestControllerAdvice
public class Errors {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> api(ApiException e) { return response(e.status,e.code,e.getMessage()); }
    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException e) {
        var result=response(400,"VALIDATION_ERROR","Check the supplied fields");
        var fields=new LinkedHashMap<String,String>();
        e.getBindingResult().getFieldErrors().forEach(f -> fields.put(f.getField(),f.getDefaultMessage()));
        result.getBody().setProperty("errors",fields); return result;
    }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ProblemDetail> malformed(Exception e) { return response(400,"VALIDATION_ERROR","Invalid request value"); }
    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ProblemDetail> conflict(Exception e) { return response(409,"CONFLICT","The value conflicts with an existing record"); }
    static ResponseEntity<ProblemDetail> response(int status,String code,String detail) {
        var p=ProblemDetail.forStatusAndDetail(HttpStatusCode.valueOf(status),detail); p.setProperty("code",code);
        return ResponseEntity.status(status).body(p);
    }
}
