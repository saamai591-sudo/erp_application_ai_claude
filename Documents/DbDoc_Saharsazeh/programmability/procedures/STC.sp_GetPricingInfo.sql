-----------------------------------
--sp_GetPricingInfo.sql:
 
Create   
PROCEDURE [STC].sp_GetPricingInfo
(
    @FinancialPeriodID INT,
    @PricingDate DATE
)
--WITH ENCRYPTION
WITH RECOMPILE
AS

declare @TableName nvarchar(MAX)

set @TableName = cfg.getTempTableName(1)

exec STC.spPricingDataSource
@FinancialPeriodID	= @FinancialPeriodID,
@PricingDate		= @PricingDate,
@TableName			= @TableName



exec (N'select * from '+ @TableName)						 


