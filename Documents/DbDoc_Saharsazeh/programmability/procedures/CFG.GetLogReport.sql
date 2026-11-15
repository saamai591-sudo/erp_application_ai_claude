CREATE proc [CFG].[GetLogReport]
	@FromDate varchar(10)=NULL,
	@ToDate varchar(10)=NULL,
	@Operation		varchar(255)=NULL,
	@TableName	nvarchar(50),
	@Schema varchar(50)=NULL

		--with encryption
AS

	if @TableName = 'Voucher' and @Schema = 'ACC'
		exec cfg.LogReport_Voucher @FromDate,@ToDate,@Operation,@TableName,@Schema

	else if @TableName = 'VoucherItem' and @Schema = 'ACC'
		exec cfg.[LogReport_VoucherItem] @FromDate,@ToDate,@Operation,@TableName,@Schema

	else if @TableName = 'AccountLevelVoucherItem' and @Schema = 'ACC'
		exec cfg.LogReport_AccountLevelVoucherItem @FromDate,@ToDate,@Operation,@TableName,@Schema

	else
	begin
	
		exec [CFG].[SpXmlSearch] @FromDate,@ToDate,@Operation,@TableName,null,@Schema,0
	

	end
