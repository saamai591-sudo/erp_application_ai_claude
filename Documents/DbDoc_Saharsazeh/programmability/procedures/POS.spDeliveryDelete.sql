
CREATE PROC [POS].[spDeliveryDelete]
    @DeliveryID INT ,
    @Version INT
AS
    SET NOCOUNT ON; 

    DECLARE @preVersion INT ,
            @PrePrevoucherID INT;
	
	
    SELECT  @preVersion = [Version] ,
            @PrePrevoucherID = PreVoucherID
    FROM    POS.Delivery
    WHERE   DeliveryID = @DeliveryID;


    IF @PrePrevoucherID IS NOT NULL
        BEGIN	     
            RAISERROR('UnableToDeletePrevoucher',16,12);
            RETURN;
		
        END;	
	
    IF @Version = @preVersion
        BEGIN	



            DELETE  FROM [POS].[Delivery]
            WHERE   [DeliveryID] = @DeliveryID;

        END;
    ELSE
        BEGIN
	
            RAISERROR (N'Delete_%s_%d.', -- Message text.
		16, -- Severity,
		10, -- State,
		N'Delivery', -- First argument.
		@DeliveryID); -- Second argument.)
        END;
