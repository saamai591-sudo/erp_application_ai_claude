
CREATE    PROC [CFG].spIssueFormBaseOnFormsValidation
(@EntityID INT, @EngName NVARCHAR(20),@Error INT=0 OUTPUT)
AS 
BEGIN
	DECLARE 
	        @NeedConfirm      NVARCHAR(6),
	    @DocumentStatus INT
	

	IF (@engName = 'Quotation')
	BEGIN
	    SELECT @NeedConfirm = ConfigValue
	    FROM   cfg.Configuration AS c
	    WHERE  c.ConfigKey = 'QuotationNeedConfirm'
	    
	    SELECT @DocumentStatus = CASE 
	                                  WHEN @NeedConfirm = 'True' THEN q.[Status]
	                                  ELSE CASE 
	                                            WHEN q.[Status] = 1 THEN 3
	                                            ELSE q.[Status]
	                                       END
	                             END
	    FROM   sle.Quotation AS q
	    WHERE  q.QuotationID = @EntityID
	    
	    
	    IF @DocumentStatus <> 3
	    BEGIN
	        SET @Error=1
	        
	        RETURN
	    END
	END
	

	IF (@EngName = 'Invoice')
	
	BEGIN
		SELECT @NeedConfirm = ConfigValue
		FROM   cfg.Configuration AS c
		WHERE  c.ConfigKey = 'InvoiceNeedConfirm'
	
SELECT  @DocumentStatus=CASE 
		                   WHEN @NeedConfirm = 'True' THEN q.SaleInvoiceStatus
		                   ELSE CASE 
		                             WHEN q.SaleInvoiceStatus = 1 THEN 2
		                             ELSE q.SaleInvoiceStatus
		                        END
		              END
		       FROM   sle.Invoice AS q
		       WHERE  q.InvoiceID = @EntityID

		
		IF @DocumentStatus <>2
		BEGIN
		    SET @Error=1
		    
PRINT @Error
		    RETURN
		END
	END
	IF (@EngName = 'Remittance')
	BEGIN
	    SELECT @NeedConfirm = ConfigValue
	    FROM   cfg.Configuration AS c
	    WHERE  c.ConfigKey = 'RemittanceNeedConfirm' 
	    
	    SELECT @DocumentStatus= CASE 
	                       WHEN @NeedConfirm = 'True' THEN q.[Status]
	                       ELSE CASE 
	                                 WHEN q.[Status] = 1 THEN 3
	                                 ELSE q.[Status]
	                            END
	                  END
	           FROM   sle.Remittance AS q
	           WHERE  q.RemittanceID = @EntityID
	    
	    IF @DocumentStatus<> 3
	    BEGIN
	        SET @Error=1
	        RETURN
	    END
	END
	
	IF (@EngName = 'Justification')
	BEGIN
		
		SELECT @DocumentStatus= q.[Status]
	           FROM   sle.Justification AS q
	           WHERE  q.JustificationID = @EntityID
		
	    IF @DocumentStatus <>1
	    BEGIN
	        SET @Error=1
	        RETURN
	    END
	END
END


PRINT @Error
