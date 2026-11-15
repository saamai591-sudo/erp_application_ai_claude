
create   proc [CNT].[GetConfirmStatementItemBaseDocuments]
@ContractStatementID int,
@Type TinyInt

as

DECLARE @Culture       VARCHAR(10),
		@CultureNo	   VARCHAR(10)
SET @Culture = CFG.GetuserCulture()

select @CultureNo = CultureNo
from cfg.CultureInfo
where Culture = @Culture

 


if @Type = 2
	select  a.ContractStatementItemID DocumentID,
			case when @CultureNo = 1 then a.Description else a.Description2 end Title
	from CNT.ContractStatementItem a
	where a.ContractStatementID = @ContractStatementID


if @Type = 3
	select  a.ContractStatementDetailID DocumentID,
			case when @CultureNo = 1 then a.Description else a.Description2 end Title
	from CNT.ContractStatementDetail a
	where a.ContractStatementID = @ContractStatementID
	and BaseDocumentType = 1