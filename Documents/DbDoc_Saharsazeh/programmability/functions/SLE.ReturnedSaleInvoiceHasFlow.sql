
CREATE     FUNCTION [SLE].[ReturnedSaleInvoiceHasFlow]
(
    @ID INT
)
RETURNS BIT
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Result BIT,
            @Count INT;

    IF OBJECT_ID('FIN.PaymentSubject') IS NOT NULL
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)FROM FIN.PaymentSubject WHERE ReturnedSaleInvoiceID = @ID
                     ),
                     0
                           );

    IF OBJECT_ID('REQ.PaymentRequest') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1) 
						 FROM req.PaymentRequest pr
						 JOIN req.PaymentRequestitem pri ON pri.PaymentRequestID = pr.PaymentRequestID
						 WHERE pri.BaseDocumentType = 3 AND pri.BaseDocumentID = @ID
						    AND pr.[Status] <> 3 AND pr.[Status] <> 5
                     ),
                     0
                           );

    IF OBJECT_ID('CFG.TaxData') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM CFG.TaxData AS td
                         WHERE td.DocumentID = @ID
                               AND td.DocumentName = 'ReturnedSaleInvoice'
                               AND td.Status IN ( 2, 4 )
                     ),
                     0
                           );

    IF (@Count IS NULL OR @Count = 0)
        SET @Result = 0;
    ELSE
        SET @Result = 1;

    RETURN @Result;
END;

