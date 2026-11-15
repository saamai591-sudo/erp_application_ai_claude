------------------------------------- START #7281
CREATE   FUNCTION [SLE].[ReturnedSaleJustificationItemHasFlow]
(
  @ID INT
)
RETURNS BIT
--WITH ENCRYPTION
AS

BEGIN
    DECLARE
      @Result BIT,
      @Count  INT

    IF OBJECT_ID( 'SLE.ReturnedSaleInvoiceItem' ) IS NOT NULL
            SET @Count=ISNULL( (SELECT COUNT( 1 )
              FROM SLE.ReturnedSaleInvoiceItem
              WHERE ReturnedSaleJustificationItemID=@ID), 1 )

    IF ((@Count IS NULL OR @Count=0)
    AND OBJECT_ID( 'STC.ReturnedOutgoingItem' ) IS NOT NULL)
            SET @Count=ISNULL( (SELECT COUNT( 1 )
              FROM STC.ReturnedOutgoingItem
              WHERE ReturnedSaleJustificationItemID=@ID), 1 )

    IF (@Count IS NULL
    OR @Count=0)
            SET @Result=0
    ELSE
            SET @Result=1

    RETURN @Result
END;
