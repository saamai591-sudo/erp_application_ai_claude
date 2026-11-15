
-----------------------------------------------------------
CREATE   FUNCTION [SLE].[ReturnedSaleInvoiceItemHasFlow]
(
@ID INT
)
RETURNS BIT
 --WITH ENCRYPTION
AS
BEGIN
    DECLARE @Result BIT, @Count INT = 0 

    IF OBJECT_ID('STC.ReturnedOutgoingItem') IS NOT NULL
        SET @Count = ISNULL(
                        (
                        SELECT COUNT(1)
                        FROM STC.ReturnedOutgoingItem AS td
                        WHERE td.ReturnedSaleInvoiceItemID = @ID
                        ),
                        0
                            );

    IF (@Count is null or @Count = 0 )
    SET @Result = 0
    ELSE
    SET @Result = 1

    RETURN @Result
END;
