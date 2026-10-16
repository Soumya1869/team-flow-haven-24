package dev.teamspace;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
public class Mailer {
    private final JavaMailSender sender; private final String from;
    public Mailer(JavaMailSender sender,@Value("${teamspace.mail-from}") String from) { this.sender=sender; this.from=from; }
    public void send(String recipient,String purpose,String token) {
        var message=new SimpleMailMessage(); message.setFrom(from); message.setTo(recipient);
        message.setSubject(purpose.equals("RESET")?"Reset your TeamSpace password":"Verify your TeamSpace email");
        // Tokens are delivered only by SMTP, never logs or API responses. Confirmation UI can consume these codes.
        message.setText("Your single-use TeamSpace "+(purpose.equals("RESET")?"password reset":"email verification")+
            " code is:\n\n"+token+"\n\nIt expires in "+(purpose.equals("RESET")?"30 minutes":"24 hours")+". If you did not request this, ignore this message.");
        sender.send(message);
    }
}
