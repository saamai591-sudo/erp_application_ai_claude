---------Start of #9108
CREATE   FUNCTION [CFG].ConvertToHourMinute(@Minute DECIMAL(18,5))
RETURNS VARCHAR(10)
 --WITH ENCRYPTION
  AS
BEGIN
	DECLARE @Ret VARCHAR(10),@hour VARCHAR(3)

	SET @Ret = ''
	
	IF(@Minute < 0)
	BEGIN
		SET @Minute = -1 * @Minute
		SET @Ret = '()'
	END

	
	SET @hour =  cast(@Minute as int) / 60
	set @Minute = ROUND(@Minute - (@hour*60) ,0)
	
	if @Minute = 60
	begin 
	set @hour = @hour+1
	set @Minute = 0.000
	end

	set @hour = str(@Hour,3)
	set @Minute = @Minute

	SET @Ret=SUBSTRING (@Ret,1,1) + IIF(@hour != 0, @hour, '00') + ':' + REPLACE( STR( @Minute % 60,2),' ','0') + SUBSTRING(@Ret,2,1)
	RETURN @Ret	
	
END
