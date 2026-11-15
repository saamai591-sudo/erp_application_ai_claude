
Create   FUNCTION [CFG].Num_ToWords (
	@Number Decimal (38, 2) -- Input number with as many as 18 digits
) RETURNS NVARCHAR(4000)
AS BEGIN

DECLARE @inputNumber NVARCHAR(38)

DECLARE @NumbersTable TABLE (number int, word NVARCHAR(10))
Declare @DecimalNumber Table(Number int,Word NVarchar(50))

DECLARE @outputString NVARCHAR(4000)
DECLARE @length INT
DECLARE @counter INT
DECLARE @loops INT
DECLARE @position INT
DECLARE @chunk NVARCHAR(3)
DECLARE @tensones NVARCHAR(2)
DECLARE @hundreds NVARCHAR(1)
DECLARE @tens NVARCHAR(1)
DECLARE @ones NVARCHAR(1)
DECLARE @And nvarchar(3)
DECLARE @Neg nvarchar(10),@DecimalValue Nvarchar(10),@EditedNumber decimal(36,0),@DecimalWord Nvarchar(50)


	IF @Number = 0 return N'صفر'
	IF  Left(@Number ,1) <> '-'
		SET  @Neg = ' '
	ELSE
	BEGIN
	 SET  @Neg = N'منفی '
	 SET  @Number = @Number * -1
	END
	set @EditedNumber = floor(@Number)

SELECT @inputNumber = CONVERT(Nvarchar(38), @EditedNumber)
---select @DecimalNumbers =  @Number - @EditedNumber
select @DecimalValue = substring(Cast((@Number - @EditedNumber) as nvarchar(40)),3,2)
	 , @outputString = ''
	 , @counter = 1

SELECT @length   = LEN(@inputNumber)
	 , @position = LEN(@inputNumber) - 2
	 , @loops    = LEN(@inputNumber)/3 

IF LEN(@inputNumber) % 3 <> 0 SET @loops = @loops + 1

INSERT INTO @NumbersTable   SELECT 0, ''

	UNION ALL SELECT 1, N' یک '      UNION ALL SELECT 2, N' دو '

	UNION ALL SELECT 3, N' سه '    UNION ALL SELECT 4, N' چهار '

	UNION ALL SELECT 5, N' پنج '     UNION ALL SELECT 6, N' شش '

	UNION ALL SELECT 7, N' هفت '    UNION ALL SELECT 8, N' هشت '

	UNION ALL SELECT 9, N' نه '     UNION ALL SELECT 10, N' ده '

	UNION ALL SELECT 11, N' یازده '   UNION ALL SELECT 12, N' دوازده '

	UNION ALL SELECT 13, N' سیزده ' UNION ALL SELECT 14, N' چهارده '

	UNION ALL SELECT 15, N' پانزده '  UNION ALL SELECT 16, N' شانزده '

	UNION ALL SELECT 17, N' هفده ' UNION ALL SELECT 18, N' هیجده '

	UNION ALL SELECT 19, N' نوزده ' UNION ALL SELECT 20, N' بیست '

	UNION ALL SELECT 30, N' سی '   UNION ALL SELECT 40, N' چهل '

	UNION ALL SELECT 50, N' پنجاه '    UNION ALL SELECT 60, N' شصت '

	UNION ALL SELECT 70, N' هفتاد '  UNION ALL SELECT 80, N' هشتاد '

	UNION ALL SELECT 90, N' نود '   UNION ALL SELECT 100,N' صد '

	UNION ALL SELECT 200, N' دویست '   UNION ALL SELECT 300, N' سیصد '

	UNION ALL SELECT 400, N' چهارصد '   UNION ALL SELECT 500, N' پانصد '

	UNION ALL SELECT 600, N' ششصد '   UNION ALL SELECT 700, N' هفتصد '

	UNION ALL SELECT 800, N' هشتصد '   UNION ALL SELECT 900, N' نهصد '

	insert into @DecimalNumber

	Select 10,N'یک دهم' union all
Select 11,N'یازده صدم' union all
Select 12,N'دوازده صدم' union all
Select 13,N'سیزده صدم' union all
Select 14,N'چهارده صدم' union all
Select 15,N'پانزده صدم' union all
Select 16,N'شانزده صدم' union all
Select 17,N'هفده صدم' union all
Select 18,N'هیجده صدم' union all
Select 19,N'نوزده صدم' union all
Select 20,N'دو دهم' union all
Select 21,N'بیست و یک صدم' union all
Select 22,N'بیست و دو صدم' union all
Select 23,N'بیست و سه صدم' union all
Select 24,N'بیست و چهار صدم' union all
Select 25,N'بیست و پنج صدم' union all
Select 26,N'بیست و شش صدم' union all
Select 27,N'بیست و هفت صدم' union all
Select 28,N'بیست و هشت صدم' union all
Select 29,N'بیست و نه صدم' union all
Select 30,N'سه دهم' union all
Select 31,N'سی و یک صدم' union all
Select 32,N'سی و دو صدم' union all
Select 33,N'سی و سه صدم' union all
Select 34,N'سی و چهار صدم' union all
Select 35,N'سی و پنج صدم' union all
Select 36,N'سی و شش صدم' union all
Select 37,N'سی و هفت صدم' union all
Select 38,N'سی و هشت صدم' union all
Select 39,N'سی و نه صدم' union all
Select 40,N'چهار دهم' union all
Select 41,N'چهل و یک صدم' union all
Select 42,N'چهل و دو صدم' union all
Select 43,N'چهل و سه صدم' union all
Select 44,N'چهل و چهار صدم' union all
Select 45,N'چهل و پنج صدم' union all
Select 46,N'چهل و شش صدم' union all
Select 47,N'چهل و هفت صدم' union all
Select 48,N'چهل و هشت صدم' union all
Select 49,N'چهل و نه صدم' union all
Select 50,N'پنج دهم' union all
Select 51,N'پنجاه و یک صدم' union all
Select 52,N'پنجاه و دو صدم' union all
Select 53,N'پنجاه و سه صدم' union all
Select 54,N'پنجاه و چهار صدم' union all
Select 55,N'پنجاه و پنج صدم' union all
Select 56,N'پنجاه و شش صدم' union all
Select 57,N'پنجاه و هفت صدم' union all
Select 58,N'پنجاه و هشت صدم' union all
Select 59,N'پنجاه و نه صدم' union all
Select 60,N'شش دهم' union all
Select 61,N'شصت و یک صدم' union all
Select 62,N'شصت و دو صدم' union all
Select 63,N'شصت و سه صدم' union all
Select 64,N'شصت و چهار صدم' union all
Select 65,N'شصت و پنج صدم' union all
Select 66,N'شصت و شش صدم' union all
Select 67,N'شصت و هفت صدم' union all
Select 68,N'شصت و هشت صدم' union all
Select 69,N'شصت و نه صدم' union all
Select 70,N'هفت دهم' union all
Select 71,N'هفتاد و یک صدم' union all
Select 72,N'هفتاد و دو صدم' union all
Select 73,N'هفتاد و سه صدم' union all
Select 74,N'هفتاد و چهار صدم' union all
Select 75,N'هفتاد و پنج صدم' union all
Select 76,N'هفتاد و شش صدم' union all
Select 77,N'هفتاد و هفت صدم' union all
Select 78,N'هفتاد و هشت صدم' union all
Select 79,N'هفتاد و نه صدم' union all
Select 80,N'هشت دهم' union all
Select 81,N'هشتاد و یک صدم' union all
Select 82,N'هشتاد و دو صدم' union all
Select 83,N'هشتاد و سه صدم' union all
Select 84,N'هشتاد و چهار صدم' union all
Select 85,N'هشتاد و پنج صدم' union all
Select 86,N'هشتاد و شش صدم' union all
Select 87,N'هشتاد و هفت صدم' union all
Select 88,N'هشتاد و هشت صدم' union all
Select 89,N'هشتاد و نه صدم' union all
Select 90,N'نه دهم' union all
Select 91,N'نود و یک صدم' union all
Select 92,N'نود و دو صدم' union all
Select 93,N'نود و سه صدم' union all
Select 94,N'نود و چهار صدم' union all
Select 95,N'نود و پنج صدم' union all
Select 96,N'نود و شش صدم' union all
Select 97,N'نود و هفت صدم' union all
Select 98,N'نود و هشت صدم' union all
Select 99,N'نود و نه صدم' 


if @DecimalValue = '00' 
begin 
set @DecimalWord = ''
end 
else 
begin
select @DecimalWord =  N' و ' +word from @DecimalNumber where Number = @DecimalValue
end 

WHILE @counter <= @loops BEGIN

	SET @chunk = RIGHT('000' + SUBSTRING(@inputNumber, @position, 3), 3)

	IF @chunk <> '000' BEGIN

		SELECT @tensones = SUBSTRING(@chunk, 2, 2)
			 , @hundreds = SUBSTRING(@chunk, 1, 1)
			 , @tens = SUBSTRING(@chunk, 2, 1)
			 , @ones = SUBSTRING(@chunk, 3, 1)

		IF CONVERT(INT, @tensones) <= 20 OR @Ones='0' BEGIN

			if len(@outputString)>0
				begin
				set @And=N'و '
			end
			else
			begin
				set @And=''
			end
				SET @outputString = (SELECT word
									FROM @NumbersTable

									WHERE @hundreds+'00'  = number)

							+ case @hundreds when '0' then '' else
								case @tensones when '00' then ' ' else N'و' end  end+
							(
									SELECT word
									  FROM @NumbersTable
									  WHERE @tensones = number)
				   + CASE @counter WHEN 1 THEN '' -- No name

					  WHEN 2 THEN N' هزار ' WHEN 3 THEN N' میلیون '
					   WHEN 4 THEN N' میلیارد '  WHEN 5 THEN N'هزار میلیارد '
					   WHEN 6 THEN N'  هزار هزار  ' WHEN 7 THEN N'  میلیون میلیارد '
					   WHEN 8 THEN N'  میلیون میلیون میلیارد ' 
					   ELSE '' END
							   + @And + @outputString
			END
		 ELSE BEGIN

					if len(@outputString)>0
					begin

					set @And=N'و '

					end
				else
					begin

					set @And=N''

					end

				SET @outputString = ' '

							+ (SELECT word
									FROM @NumbersTable
									WHERE @hundreds+'00'  = number)
							 + case @hundreds when '0' then ' ' else  N'و' end
							+ (SELECT word

									FROM @NumbersTable

									WHERE   @tens+'0'  = number)

							 + N'و'

							 + (SELECT word

									FROM @NumbersTable

									WHERE  @ones = number)

				  + CASE @counter WHEN 1 THEN '' -- No name

					   WHEN 2 THEN N' هزار ' WHEN 3 THEN N' میلیون '

					   WHEN 4 THEN N' میلیارد '  WHEN 5 THEN N'هزار میلیارد '

					   WHEN 6 THEN N'  هزار هزار  ' WHEN 7 THEN N'  میلیون میلیارد '

					   WHEN 8 THEN N'  میلیون میلیون میلیارد ' 
					   ELSE '' END
							+ @And + @outputString
		END
	END

	SELECT @counter = @counter + 1
		 , @position = @position - 3
		 
END

	SET @outputString = LTRIM(RTRIM(REPLACE(@outputString, '  ', ' ')))

	SET @outputstring = UPPER(LEFT(@outputstring, 1)) + SUBSTRING(@outputstring, 2, 8000)

	SET @outputstring = @Neg + @outputstring + @DecimalWord

	RETURN @outputstring

END;
