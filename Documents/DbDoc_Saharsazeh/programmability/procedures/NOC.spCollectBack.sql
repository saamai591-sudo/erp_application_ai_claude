
CREATE   proc NOC.spCollectBack
(
@ReportagePeriodID int,
@Type tinyint 
)
as

	if exists (select * from noc.Analysing where ReportagePeriodID = @ReportagePeriodID)
	begin
		
		raiserror(N'به دلیل وجود پایش یا تعدیلات نرخ ارز امکان برگشت اطلاعات وجود ندارد.',16,12)
		return
	end

	delete
	from NOC.DataCollection
	where ReportagePeriodID = @ReportagePeriodID and [Type] = @Type
