
CREATE   PROCEDURE [STC].sp_PricingValidation
(
    @PricingDate        Date,
    @selItems           NVARCHAR(MAX),
    @FinancialPeriodID  INT
)
--WITH ENCRYPTION
WITH RECOMPILE
     AS

SET NOCOUNT on


DECLARE @TableName NVARCHAR(MAX)

SET @TableName = cfg.getTempTableName(1)

EXEC stc.spPricingValidationSource
     @PricingDate = @PricingDate,
     @selItems = @selItems,
     @FinancialPeriodID = @FinancialPeriodID,
     @TableName = @TableName

EXEC (N'select * from ' + @TableName)
