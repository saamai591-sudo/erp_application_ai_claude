
CREATE     FUNCTION [CNT].[ContractStatementHasFlow]
(
    @ContractStatementID INT
)
RETURNS BIT
--WITH ENCRYPTION
AS
BEGIN
    DECLARE @Count INT,
            @Result BIT;

    SET @Count = ISNULL(
                 (
                     SELECT COUNT(1)
                     FROM CNT.ConfirmStatement
                     WHERE ContractStatementID = @ContractStatementID
                 ),
                 0
                       );

    IF OBJECT_ID('CFG.TaxData') IS NOT NULL
       AND @Count = 0
        SET @Count = ISNULL(
                     (
                         SELECT COUNT(1)
                         FROM CFG.TaxData AS td
                         WHERE td.DocumentID = @ContractStatementID
                               AND td.DocumentName = 'ContractStatement'
                               AND td.Status IN ( 2, 4 )
                     ),
                     0
                           );

    IF  @Count = 0
        SET @Count = ISNULL(
                     (   SELECT COUNT(*)
                         FROM   req.PaymentRequestItem a
						 join req.PaymentRequest b
							on a.PaymentRequestID = b.PaymentRequestID
                         WHERE  BaseDocumentType = 5
							and BaseDocumentID = @ContractStatementID
							and b.Status <> 3 and b.Status <> 5) ,
                     0);

    IF (@Count IS NULL OR @Count = 0)
        SET @Result = 0;
    ELSE
        SET @Result = 1;

    RETURN @Result;
END;

